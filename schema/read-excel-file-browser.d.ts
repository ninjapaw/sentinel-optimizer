declare module "read-excel-file/browser" {
  interface WorkbookSheet {
    sheet: string;
    data: unknown[][];
  }

  const readXlsxFile: (input: ArrayBuffer) => Promise<WorkbookSheet[]>;
  export default readXlsxFile;
}