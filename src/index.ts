import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IFile, IUpfileOptions } from './types';

export class Upfile extends EventEmitter {
  request: any;
  response: any;
  next: Function | undefined;

  options: IUpfileOptions | undefined;

  private static BOUNDARY_ELEMENT_SIZE = 256;

  private readonly _destination: string;
  private _data: Buffer[] = [];
  private _contentType: string | undefined;

  constructor(destination: string, options?: IUpfileOptions) {
    super();
    this._destination = destination;
    this.options = options;
  }

  parseIncomingBody(request: any, response: any, next?: Function): void {
    this.request = request;
    this.response = response;
    this.next = next;
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
      await fs.writeFile(path.join(os.tmpdir(), 'upfile'), Buffer.concat(this._data));
      await this._parse();
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
      const header: string = Upfile._parseBoundary(data, starts[i], boundary);
      const parts: string[] = header.substring(0).split('\r\n\r\n');
      let fileName; // only populated if there is a file
      let fieldName = Upfile._parseFieldName('name=', parts[0]);
      if ( parts[0].includes('filename') ) {
        const fileInfoParts: string[] = parts[0].split('\r\n');
        fileName = Upfile._parseFieldName('filename=', fileInfoParts[0]);
        let fileType = fileInfoParts[1].split('Content-Type: ')[1];

        const file: IFile = await this._saveFile(fileName, fileType, fieldName, data.slice(starts[i] + header.split('\r\n\r\n')[0].length + ('--' + boundary).length + 6, starts[i + 1]));

        this.request!.files.push(file);
      } else {
        // name = Upfile._parseFieldName('name=', parts[0]);
        // Object.defineProperty(this.request!.formData, fieldName, { value: parts[1].split('\r\n')[0] });
        this.request!.formData[fieldName] = { value: parts[1].split('\r\n')[0] };
      }
    }

    await fs.rm(path.join(os.tmpdir(), 'upfile'));

    // if the framework we are using has a next() function we can just pass and call it
    // like this we do not need to listen/emit the uploaded event
    if ( this.next !== undefined ) {
      return this.next();
    }

    this.emit('uploaded');
    return Promise.resolve();
  }

  private async _saveFile(name: string, fileType: string, fieldName: string, file: any): Promise<IFile> {
    const fileExtension: string = '.' + Upfile._fileExtension(name);
    const fileName: string = Upfile._parseFileName(name, fileExtension);

    let finalName: string = this.options?.custom ? this.options.custom : fileName;
    if ( this.options && !this.options.custom ) {
      finalName = this.options.prefix + finalName + this.options.suffix;
    }

    finalName += fileExtension;
    let filePath: string = path.join(this._destination, finalName);

    await this._verifyFolder();

    await fs.writeFile(path.join(process.cwd(), filePath), Buffer.from(file), {
      encoding: 'binary',
    });

    return {
      fieldName: fieldName,
      originalName: name,
      fileName: finalName,
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

  private _validateContentType(): void {
    if ( typeof this._contentType === 'undefined' || this._contentType === null ) {
      throw new Error('No content-type was defined.');
    }

    if ( !this._contentType.includes('multipart/form-data') ) {
      throw new Error('Not a multipart/form-data submission.');
    }
  }

  private static _parseFieldName(separator: string, field: string): string {
    let name: string = field.split(separator)[1];
    return name.substring(1, name.length - 1);
  }

  // because we are not sure of the size of the file information, we can then grab 256 elements
  private static _parseBoundary(data: Buffer, start: number, boundary: string): string {
    return data.slice(start + ('--' + boundary).length + 2, start + Upfile.BOUNDARY_ELEMENT_SIZE).toString();
  }

  // this is to remove the extension from the file name
  private static _parseFileName(fullFileName: string, fileExtension: string): string {
    return fullFileName.split(fileExtension)[0];
  }

  private static _fileExtension(fileName: string): string {
    const fileNameParts: string[] = fileName.split('.');
    return fileNameParts[fileNameParts.length - 1];
    // return mimeType.split('/')[1];
  }
}
