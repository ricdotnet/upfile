import { Buffer } from 'buffer';
import { IncomingMessage, OutgoingMessage } from 'http';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface IIncomingMessage extends IncomingMessage {
  [key: string]: any;

  // formData: {};
  // files: IFile[];
}

interface IFile {
  fileName: string;
  fileType: string;
  file: string;
}

export class Upfile extends EventEmitter {
  request: IIncomingMessage | null = null;
  response: OutgoingMessage | null = null;

  private readonly _destination: string;
  private _data: Buffer[] = [];
  private _contentType: string | undefined;

  constructor(destination: string) {
    super();
    this._destination = destination;
  }

  parseIncomingBody(request: IIncomingMessage, response: OutgoingMessage): void {
    this.request = request;
    this.response = response;
    this._data = []; // reset the buffer

    if ( this.request === null || this.response === null ) {
      throw new Error('Make sure there is a request and a response to work with.');
    }

    this._contentType = this.request.headers['content-type'];

    this._validateContentType();

    this.request.on('data', (chunk: any): void => {
      this._data.push(chunk);
    });
    this.request.on('end', async () => {
      // let data = Buffer.concat(this._data).toString('binary');
      await fs.writeFile(path.join(os.tmpdir(), 'upfile'), Buffer.concat(this._data));
      this._parse();
    });
  }

  private async _parse(): Promise<void> {
    const boundary = this._contentType!.split('boundary=')[1];

    if ( !boundary ) {
      throw new Error('Invalid boundary.');
    }

    const data: Buffer = await fs.readFile(path.join(os.tmpdir(), 'upfile'));

    // append files and formData to the request object
    Object.assign(this.request!, { files: [] });
    Object.assign(this.request!, { formData: {} });

    const starts: number[] = [];
    let start: number = 0;
    while ( true ) {
      start = data.indexOf('--' + boundary, start);
      if ( start === -1 ) break;
      starts.push(start);
      ++start; // this will move the start index one over to search for another boundary start
    }

    // todo: refactor
    for ( let i: number = 0; i < starts.length - 1; i++ ) {
      const header: string = data.slice(starts[i] + ('--' + boundary).length + 2, starts[i] + 512).toString(); // select 512 elements max
      const parts: string[] = header.substring(0, starts[i] + 512).split('\r\n\r\n');
      let name;
      if ( parts[0].includes('filename') ) {
        const fileInfoParts: string[] = parts[0].split('\r\n');
        name = Upfile._parseFieldName('filename=', fileInfoParts[0]);
        let fileType = fileInfoParts[1].split('Content-Type: ')[1];

        const file: IFile = await this._saveFile(name, fileType, data.slice(starts[i] + header.split('\r\n\r\n')[0].length + ('--' + boundary).length + 6, starts[i + 1]));

        this.request!.files.push(file);
      } else {
        name = Upfile._parseFieldName('name=', parts[0]);
        Object.defineProperty(this.request!.formData, name, { value: parts[1].split('\r\n')[0] });
      }
    }

    await fs.rm(path.join(os.tmpdir(), 'upfile'));
    this.emit('uploaded');
  }

  private async _saveFile(name: string, fileType: string, file: any): Promise<IFile> {
    let filePath: string = path.join(this._destination, name);

    await this._verifyFolder();

    await fs.writeFile(path.join(process.cwd(), filePath), Buffer.from(file), {
      encoding: 'binary',
    });

    return {
      fileName: name,
      fileType: fileType,
      file: filePath,
    };
  }

  private async _verifyFolder(): Promise<void> {
    try {
      await fs.access(path.join(process.cwd(), this._destination));
    } catch (e) {
      await fs.mkdir(this._destination, { recursive: true });
    }
    return Promise.resolve();
  }

  private static _parseFieldName(separator: string, field: string): string {
    let name = field.split(separator)[1];
    return name.substring(1, name.length - 1);
  }

  private _validateContentType(): void {
    if ( typeof this._contentType === 'undefined' || this._contentType === null ) {
      throw new Error('No content-type was defined.');
    }

    if ( !this._contentType.includes('multipart/form-data') ) {
      throw new Error('Not a multipart/form-data submission.');
    }
  }
}
