// Owner Expenses API (money out). Owner / Super Admin only. See api/_lib/expensesCore.js for the rules.
import multer from 'multer'
import { financeRoute, created } from '../financeRoute.js'
import { FinanceError } from '../finance.js'
import {
  createExpense, listExpenses, expenseSummary, getExpense, serializeExpense, updateExpense, markExpensePaid, voidExpense, previousBill, createNextRent,
} from '../expensesCore.js'
import { addAttachment, streamAttachment, MAX_FILE_BYTES } from '../financeFiles.js'
import { listVendors, createVendor } from '../financeVendors.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

// GET /api/owner/expenses ; POST /api/owner/expenses
export const expensesCollection = financeRoute('owner expenses', {
  GET: (ctx, req) => listExpenses(ctx.db, req.query || {}),
  POST: async (ctx, req) => created({ expense: serializeExpense(await createExpense(ctx.db, ctx, body(req))) }),
})

// GET /api/owner/expenses/summary
export const expensesSummary = financeRoute('owner expenses summary', { GET: (ctx, req) => expenseSummary(ctx.db, req.query || {}) })

// GET /api/owner/expenses/previous-bill?utility_type=&branch_id=
export const expensesPreviousBill = financeRoute('owner expenses previous bill', { GET: (ctx, req) => previousBill(ctx.db, req.query || {}) })

// POST /api/owner/expenses/:id/next-rent -> creates next month's Unpaid rent bill from a recurring one (button, never automatic)
export const expenseNextRent = financeRoute('owner expense next rent', { POST: async (ctx, req) => created({ expense: serializeExpense(await createNextRent(ctx.db, ctx, req.params.id)) }) })

// GET / PATCH /api/owner/expenses/:id
export const expenseItem = financeRoute('owner expense', {
  GET: async (ctx, req) => ({ expense: serializeExpense(await getExpense(ctx.db, req.params.id)) }),
  PATCH: async (ctx, req) => ({ expense: serializeExpense(await updateExpense(ctx.db, ctx, req.params.id, body(req))) }),
})

// POST /api/owner/expenses/:id/mark-paid  and  /void
export const expenseMarkPaid = financeRoute('owner expense mark paid', { POST: async (ctx, req) => ({ expense: serializeExpense(await markExpensePaid(ctx.db, ctx, req.params.id, body(req))) }) })
export const expenseVoid = financeRoute('owner expense void', { POST: async (ctx, req) => ({ expense: serializeExpense(await voidExpense(ctx.db, ctx, req.params.id, body(req))) }) })

// POST /api/owner/expenses/:id/attachments (multipart, field "file") ; GET /api/owner/expenses/:id/attachments/:index
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } }).single('file')
// The session and role are checked BEFORE the upload is read into memory.
export const expenseAttachments = financeRoute('owner expense attach', {
  POST: (ctx, req, res) => new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) return reject(err.code === 'LIMIT_FILE_SIZE' ? new FinanceError('FILE_TOO_LARGE', 'Each file must be 5 MB or smaller.', 413) : new FinanceError('VALIDATION_ERROR', 'The upload could not be read.', 422, { fields: { file: 'Invalid upload.' } }))
      addAttachment(ctx.db, ctx, req.params.id, req.file).then((a) => resolve(created({ attachment: a }))).catch(reject)
    })
  }),
})
export const expenseAttachmentFile = financeRoute('owner expense file', { GET: async (ctx, req, res) => { await streamAttachment(ctx.db, req.params.id, req.params.index, res) } })

// GET / POST /api/owner/vendors
export const vendorsRoute = financeRoute('owner vendors', {
  GET: async (ctx, req) => ({ vendors: await listVendors(ctx.db, req.query || {}) }),
  POST: async (ctx, req) => created({ vendor: await createVendor(ctx.db, ctx, body(req)) }),
})
