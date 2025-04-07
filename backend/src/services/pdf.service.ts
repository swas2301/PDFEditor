import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private pdfPath = path.join(__dirname, '../../storage/example.pdf');

  async getPdf(): Promise<Buffer> {
    return fs.promises.readFile(this.pdfPath);
  }

  async savePdf(pdfBuffer: Buffer): Promise<void> {
    await fs.promises.writeFile(this.pdfPath, pdfBuffer);
  }
}