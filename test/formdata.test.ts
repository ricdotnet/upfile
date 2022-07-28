jest.mock('../dist');

import { formData } from './mocks';
import { Upfile } from '../dist';

describe('formdata', () => {
  test('formdata is defined', () => {
    expect(formData).toBeDefined();

    const fn = jest.spyOn(Upfile as any, '_parseFieldName').getMockImplementation();
    console.log(fn);

    expect(fn!('=name', 'Content-Disposition: form-data; name="filefield"; filename="index.html"')).toBe('filefield');
  });
});
