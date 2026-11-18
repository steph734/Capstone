// Owner Invoices API (patient invoices, money in). Owner / Super Admin only. Rules live in api/_lib/invoicesCore.js.
import { financeRoute, created } from '../financeRoute.js'
import { FinanceError, validationError, toOid } from '../finance.js'
import {
  createInvoice, listInvoices, invoiceSummary, getInvoice, serializeInvoice, updateInvoice, sendInvoice, remindInvoice, markInvoicePaid, voidInvoice,
  searchPatients, billableSessions, clinicInfo, invoiceClinic,
} from '../invoicesCore.js'
import { buildInvoicePdf } from '../invoicePdf.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})
const view = (inv) => serializeInvoice(inv)

// GET /api/owner/invoices ; POST /api/owner/invoices  (header: Idempotency-Key)
export const invoicesCollection = financeRoute('owner invoices', {
  GET: (ctx, req) => listInvoices(ctx.db, req.query || {}),
  POST: async (ctx, req) => {
    const key = String(req.headers['idempotency-key'] || '').trim()
    if (key && !/^[\w\-:.]{8,100}$/.test(key)) throw validationError({ 'Idempotency-Key': 'Use 8 to 100 letters, digits or - _ : .' })
    const { invoice, idempotent } = await createInvoice(ctx.db, ctx, body(req), key || null)
    if (idempotent) return { invoice: view(invoice), idempotent: true }
    // Create & send: the invoice is already saved as Pending; email failure does not undo it.
    if (body(req).send === true) {
      const sent = await sendInvoice(ctx.db, ctx, String(invoice._id))
      return created({ invoice: view(sent.invoice), emailed: sent.emailed, ...(sent.flag ? { flag: sent.flag } : {}) })
    }
    return created({ invoice: view(invoice) })
  },
})

export const invoicesSummary = financeRoute('owner invoices summary', { GET: (ctx, req) => invoiceSummary(ctx.db, req.query || {}) })
export const invoicePatients = financeRoute('owner invoice patients', { GET: async (ctx, req) => ({ patients: await searchPatients(ctx.db, req.query || {}) }) })
export const invoiceItem = financeRoute('owner invoice', {
  GET: async (ctx, req) => ({ invoice: view(await getInvoice(ctx.db, req.params.id)) }),
  PATCH: async (ctx, req) => ({ invoice: view(await updateInvoice(ctx.db, ctx, req.params.id, body(req))) }),
})
export const invoiceSend = financeRoute('owner invoice send', {
  POST: async (ctx, req) => { const r = await sendInvoice(ctx.db, ctx, req.params.id); return { invoice: view(r.invoice), emailed: r.emailed, ...(r.flag ? { flag: r.flag } : {}) } },
})
export const invoiceRemind = financeRoute('owner invoice remind', { POST: async (ctx, req) => ({ invoice: view((await remindInvoice(ctx.db, ctx, req.params.id)).invoice) }) })
export const invoiceMarkPaid = financeRoute('owner invoice mark paid', { POST: async (ctx, req) => ({ invoice: view(await markInvoicePaid(ctx.db, ctx, req.params.id, body(req))) }) })
export const invoiceVoid = financeRoute('owner invoice void', { POST: async (ctx, req) => ({ invoice: view(await voidInvoice(ctx.db, ctx, req.params.id, body(req))) }) })

// GET /api/owner/invoices/:id/pdf  (behind the session: the PDF is generated from saved data, never stored publicly)
export const invoicePdf = financeRoute('owner invoice pdf', {
  GET: async (ctx, req, res) => {
    const inv = await getInvoice(ctx.db, req.params.id)
    const pdf = Buffer.from(buildInvoicePdf(inv, await invoiceClinic(ctx.db, inv)))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoice_no}.pdf"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).end(pdf)
  },
})

// GET /api/owner/patients/:id/billable-sessions?from=&to=
export const patientBillableSessions = financeRoute('owner billable sessions', { GET: async (ctx, req) => ({ sessions: await billableSessions(ctx.db, req.params.id, req.query || {}) }) })

// GET /api/owner/clinic?branch_id=  ->  clinic details for invoice headers (clinic_settings + the branch's address/phone)
// Read only. The Owner cannot write clinic or branch details; the old clinic-wide PUT is now a 403 FORBIDDEN.
// (The clinic NAME lives in clinic_settings._id 'clinic'; the TIN and the other details are on each branch.)
export const clinicRoute = financeRoute('owner clinic', {
  GET: async (ctx, req) => ({ clinic: await clinicInfo(ctx.db, req.query?.branch_id ? toOid(req.query.branch_id, 'branch_id') : null) }),
  PUT: async () => { throw new FinanceError('FORBIDDEN', 'These details are managed by the Super Admin under Branches.', 403) },
})
