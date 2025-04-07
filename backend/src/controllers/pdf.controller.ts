import {
    Controller,
    Get,
    Post,
    Res,
    Body,
    Header,
    UploadedFile,
    UseInterceptors,
  } from '@nestjs/common';
  import { Response } from 'express';
  import { PdfService } from '../services/pdf.service';
  import { FileInterceptor } from '@nestjs/platform-express';
  
  @Controller('pdf')
  export class PdfController {
    constructor(private readonly pdfService: PdfService) {}
  
    @Get('load')
    async loadPdf(@Res() res: Response) {
      const pdf = await this.pdfService.getPdf();
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdf);
    }
  
    @Post('save')
    @UseInterceptors(FileInterceptor('file'))
    async savePdf(@UploadedFile() file: Express.Multer.File) {
      await this.pdfService.savePdf(file.buffer);
      return { message: 'PDF saved successfully.' };
    }
  }
  