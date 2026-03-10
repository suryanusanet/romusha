import { pool } from './nis.mysql'

export async function getCustomerTransactionItem(customerId: string) {
  const sql = [
    'SELECT si.serial AS serials, m.Name AS item_description',
    'FROM StockInvoiceHead sih',
    'LEFT JOIN StockInvoice si ON sih.No = si.No',
    'LEFT JOIN Customer c ON sih.CustId = c.CustId',
    'LEFT JOIN Master m',
    'ON si.Code = m.Code AND m.Branch = IFNULL(c.DisplayBranchId, c.BranchId)',
    'WHERE sih.CustId = ?',
    'AND NOT (si.serial = "")',
    'AND NOT (m.Name IS NULL)',
    'AND NOT (si.Code IN (',
    '"SETUP000", "JSTRKKBL", "TARIKKBL", "TOWER000", "TARIKKBV", "INSTALWF",',
    '"TRKKBLDT", "TRKKBLFO", "MNTNCE00", "JSSETTAP", "TARKBLFO"))',
  ].join(' ')

  const [rows] = await pool.execute(sql, [customerId])
  const items = (
    rows as Array<{ serials: string | null; item_description: string | null }>
  )
    .flatMap(({ serials, item_description }) =>
      serials
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((serial) => ({
          serial,
          description: item_description,
        })),
    )
    .reduce((acc: any, item: any) => {
      const isDuplicate = acc.some((el: any) => {
        return el.serial === item.serial
      })
      if (!isDuplicate) acc.push(item)
      return acc
    }, [])
  return items
}

export async function getItemNameBySerial(serial: string) {
  const sql = [
    'SELECT m.Name FROM stock_barcode sb',
    'LEFT JOIN Master m ON sb.code = m.Code AND sb.branch_id = m.Branch',
    'WHERE sb.barcode = ?',
  ].join(' ')
  const [rows] = await pool.execute(sql, [serial])

  if (rows && Array.isArray(rows) && rows.length > 0) {
    return (rows[0] as { Name: string }).Name
  }

  return ''
}

export async function getLatestItemTransaction(serial: string) {
  const sql = [
    'SELECT sbh.type, sbh.type_id AS type_object_id',
    'FROM stock_barcode_history sbh',
    'LEFT JOIN stock_barcode sb ON sbh.barcode_id = sb.id',
    'WHERE sb.barcode = ?',
    'ORDER BY sbh.time DESC LIMIT 1',
  ].join(' ')
  const [rows] = await pool.execute(sql, [serial])

  const returnData: any = {}
  for (const { type, type_object_id: typeObjectId } of rows as Array<{
    type: string
    type_object_id: string
  }>) {
    returnData.type = type
    returnData.typeObjectId = typeObjectId
  }
  return returnData
}

export async function getItemInvoiceDetail(invoiceId: string) {
  const sql = [
    'SELECT (sih.RNo <> 0) AS isReversed, (sih.Type = 1) AS isRequest,',
    'sh.CustId AS customer_id, cs.CustAccName AS subscriber, sih.Status as status',
    'FROM StockInvoiceHead sih',
    'LEFT JOIN SPMBHead sh ON sih.Spmb = sh.No',
    'LEFT JOIN CustomerServices cs ON sh.CustServId = cs.CustServId',
    'WHERE sih.No = ?',
  ].join(' ')
  const [rows] = await pool.execute(sql, [invoiceId])
  const returnData: any = {}
  for (const {
    isReversed,
    isRequest,
    customer_id: customerId,
    subscriber,
    status,
  } of rows as any) {
    if (isReversed && isRequest) continue
    if (!isRequest && !isReversed) continue
    if (['BL', 'RK'].includes(status)) continue
    returnData.customerId = customerId
    returnData.subscriber = subscriber
  }
  return returnData
}

export async function getSerialTransactionHistory(serial: string) {
  const sql = [
    'SELECT sbh.type, sbh.type_id AS type_object_id,',
    'IFNULL(sih.CustId, "") AS customer_id,',
    'IFNULL(p.InvoiceDate, sih.Date) AS type_date,',
    'sih.Status AS invoice_status, sih.Type AS invoice_type, sih.Reverse AS is_reversed',
    'FROM stock_barcode_history sbh',
    'LEFT JOIN stock_barcode sb ON sbh.barcode_id = sb.id',
    'LEFT JOIN Purchase p ON sbh.type = "purchase" AND sbh.type_id = p.Id',
    'LEFT JOIN StockInvoiceHead sih ON sbh.type = "invoice" AND sbh.type_id = sih.No',
    'WHERE sb.barcode = ? AND sbh.type NOT IN("spmb")',
    'ORDER BY sbh.time',
  ].join(' ')
  const [rows] = await pool.execute(sql, [serial])
  return rows
}
