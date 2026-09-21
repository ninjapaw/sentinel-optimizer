export * from "../../../schema/cloudSecurityMapper.js";

import readXlsxFile from "read-excel-file/browser";
import { parseMapperWorkbookSheets } from "../../../schema/cloudSecurityMapper.js";

export async function parseMapperWorkbook(
  data: ArrayBuffer,
  sheetName?: string,
) {
  const sheets = await readXlsxFile(data);
  return parseMapperWorkbookSheets(sheets, sheetName);
}
