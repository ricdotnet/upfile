import { IncomingMessage } from 'http';

interface IIncomingMessage extends IncomingMessage {
  [key: string]: any;

  // formData: {};
  // files: IFile[];
}

interface IFile {
  fieldName: string;
  originalName: string;
  fileName: string;
  fileType: string;
  file: string;
}

interface IUpfileOptions {
  prefix?: string;
  suffix?: string;
  custom?: string;
}

export {
  IIncomingMessage,
  IFile,
  IUpfileOptions,
};
