const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { randomUUID } = require('crypto');
const Email = require('../models/Email');
const EmailMailbox = require('../models/EmailMailbox');
const { getSupabaseAdmin, ATTACHMENTS_BUCKET } = require('../lib/supabaseAdmin');
const {
  resolveCaller,
  therapistOwnsPatient,
  guardianUserIdForPatient,
  patientNameById,
  userDisplayInfo,
} = require('../lib/emailAuth');

const router = express.Router();

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

function oid(id) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

async function uploadAttachments(emailId, files) {
  if (!files?.length) return [];
  const supabase = getSupabaseAdmin();
  const out = [];
  for (const file of files) {
    const path = `emails/${emailId}/${randomUUID()}-${file.originalname}`;
    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error(`Could not upload attachment "${file.originalname}": ${error.message}`);
    out.push({ file_name: file.originalname, file_path: path, file_type: file.mimetype, file_size: file.size });
  }
  return out;
}

async function deleteAttachmentFiles(attachments) {
  if (!attachments?.length) return;
  try {
    const supabase = getSupabaseAdmin();
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(attachments.map((a) => a.file_path));
  } catch (err) {
    console.error('emails: could not delete attachment files:', err.message);
  }
}

// POST /api/emails — send or save a draft. JSON or multipart (field `data`
// as a JSON string + up to 5 files under `attachments`).
router.post('/', upload.fields([{ name: 'attachments', maxCount: 5 }]), async (req, res) => {
  try {
    const isMultipart = req.is('multipart/form-data');
    const payload = isMultipart ? JSON.parse(req.body.data || '{}') : req.body || {};
    const files = req.files?.attachments || [];

    const callerEmail = String(payload.senderEmail || '').trim().toLowerCase();
    const caller = await resolveCaller(callerEmail);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '');
    const emailStatus = payload.email_status === 'draft' ? 'draft' : 'sent';
    const draftId = oid(payload.draft_id);
    const replyToId = oid(payload.reply_to_email_id);

    if (subject.length > 200) return res.status(400).json({ error: 'Subject is too long (max 200 characters).' });
    if (body.length > 20000) return res.status(400).json({ error: 'Message is too long (max 20,000 characters).' });
    if (emailStatus === 'sent' && !subject) return res.status(400).json({ error: 'Subject is required.' });
    if (emailStatus === 'sent' && !body) return res.status(400).json({ error: 'Message body is required.' });

    // Resuming a saved draft: load it so we know the thread/recipients it
    // already belongs to, and confirm the caller actually owns it.
    let draft = null;
    if (draftId) {
      draft = await Email.findById(draftId);
      if (!draft || String(draft.sender_id) !== String(caller.user._id)) {
        return res.status(403).json({ error: 'That draft does not belong to you.' });
      }
    }

    let recipientIds = [];
    let patientId = draft?.patient_id || null;
    let threadId = draft?.thread_id || null;
    let parentEmail = null;

    if (replyToId) {
      parentEmail = await Email.findById(replyToId);
      if (!parentEmail) return res.status(400).json({ error: 'The email you are replying to no longer exists.' });
      const hasAccess = await EmailMailbox.exists({ user_id: caller.user._id, email_id: parentEmail._id });
      if (!hasAccess) return res.status(403).json({ error: "You don't have access to that email." });

      const participants = [parentEmail.sender_id, ...parentEmail.recipient_ids].map(String);
      recipientIds = [...new Set(participants)].filter((id) => id !== String(caller.user._id)).map(oid);
      patientId = parentEmail.patient_id;
      threadId = parentEmail.thread_id;
    } else if (draft && draft.reply_to_email_id) {
      // Sending a draft that was itself a reply.
      parentEmail = await Email.findById(draft.reply_to_email_id);
      recipientIds = draft.recipient_ids;
    } else {
      // A brand-new thread — only therapists may start one.
      if (caller.role !== 'therapist') {
        return res.status(403).json({ error: 'Guardians can only reply to an email they received.' });
      }
      patientId = oid(payload.patient_id) || patientId;
      if (!patientId) return res.status(400).json({ error: 'Missing patient_id.' });
      if (!caller.employee) return res.status(403).json({ error: "Your account isn't linked to a staff record yet." });
      const owns = await therapistOwnsPatient(caller.employee._id, patientId);
      if (!owns) return res.status(403).json({ error: "You don't have an appointment on record with this patient." });
      const guardianUserId = await guardianUserIdForPatient(patientId);
      if (!guardianUserId) return res.status(400).json({ error: "This patient's guardian doesn't have a TherapyPro account yet." });
      recipientIds = [guardianUserId];
    }

    if (!recipientIds.length) return res.status(400).json({ error: 'No recipient could be determined for this email.' });

    const now = new Date();
    const newId = draft ? draft._id : new mongoose.Types.ObjectId();
    if (!threadId) threadId = newId;

    let attachments = draft?.attachments || [];
    if (files.length) {
      attachments = await uploadAttachments(newId, files);
    }

    const docFields = {
      sender_id: caller.user._id,
      recipient_ids: recipientIds,
      patient_id: patientId,
      subject,
      body,
      email_status: emailStatus,
      thread_id: threadId,
      reply_to_email_id: replyToId || draft?.reply_to_email_id || null,
      attachments,
      email_sent_at: emailStatus === 'sent' ? now : null,
    };

    let email;
    if (draft) {
      Object.assign(draft, docFields);
      email = await draft.save();
    } else {
      email = await Email.create({ _id: newId, ...docFields });
    }

    if (emailStatus === 'draft') {
      await EmailMailbox.findOneAndUpdate(
        { user_id: caller.user._id, email_id: email._id },
        { $set: { folder: 'drafts', is_read: true } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      await EmailMailbox.findOneAndUpdate(
        { user_id: caller.user._id, email_id: email._id },
        { $set: { folder: 'sent', is_read: true }, $unset: { deleted_at: '' } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      await Promise.all(
        recipientIds.map((rid) =>
          EmailMailbox.findOneAndUpdate(
            { user_id: rid, email_id: email._id },
            { $set: { folder: 'inbox', is_read: false }, $unset: { deleted_at: '' } },
            { upsert: true, setDefaultsOnInsert: true }
          )
        )
      );
    }

    return res.status(200).json({ email });
  } catch (err) {
    console.error('POST /api/emails error:', err);
    return res.status(500).json({ error: err.message || 'Could not send email.' });
  }
});

// GET /api/emails?email=&folder=&search=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const caller = await resolveCaller(req.query.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const folder = String(req.query.folder || 'inbox');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim();

    const match = { user_id: caller.user._id };
    if (folder === 'starred') {
      match.is_starred = true;
      match.folder = { $ne: 'trash' };
    } else {
      match.folder = folder;
    }

    let mailboxRows = await EmailMailbox.find(match).sort({ mailbox_created_at: -1 }).lean();

    let emails = await Email.find({ _id: { $in: mailboxRows.map((r) => r.email_id) } }).lean();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      emails = emails.filter((e) => re.test(e.subject) || re.test(e.body));
    }
    const emailById = new Map(emails.map((e) => [String(e._id), e]));
    mailboxRows = mailboxRows.filter((r) => emailById.has(String(r.email_id)));

    const start = (page - 1) * limit;
    const pageRows = mailboxRows.slice(start, start + limit);

    const allUserIds = new Set();
    for (const row of pageRows) {
      const e = emailById.get(String(row.email_id));
      allUserIds.add(String(e.sender_id));
      e.recipient_ids.forEach((id) => allUserIds.add(String(id)));
    }
    const displayInfo = await userDisplayInfo([...allUserIds]);

    const items = await Promise.all(
      pageRows.map(async (row) => {
        const e = emailById.get(String(row.email_id));
        const patientName = await patientNameById(e.patient_id);
        return {
          id: String(e._id),
          sender: displayInfo.get(String(e.sender_id)) || { name: 'Unknown' },
          recipients: e.recipient_ids.map((id) => displayInfo.get(String(id)) || { name: 'Unknown' }),
          patientName,
          subject: e.subject,
          snippet: e.body.slice(0, 140),
          attachmentCount: e.attachments.length,
          email_status: e.email_status,
          email_sent_at: e.email_sent_at,
          email_created_at: e.email_created_at,
          is_read: row.is_read,
          is_starred: row.is_starred,
          folder: row.folder,
        };
      })
    );

    return res.status(200).json({ emails: items, page, total: mailboxRows.length });
  } catch (err) {
    console.error('GET /api/emails error:', err);
    return res.status(500).json({ error: err.message || 'Could not load emails.' });
  }
});

// GET /api/emails/unread-count?email=
router.get('/unread-count', async (req, res) => {
  try {
    const caller = await resolveCaller(req.query.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });
    const count = await EmailMailbox.countDocuments({ user_id: caller.user._id, folder: 'inbox', is_read: false });
    return res.status(200).json({ count });
  } catch (err) {
    console.error('GET /api/emails/unread-count error:', err);
    return res.status(500).json({ error: err.message || 'Could not load unread count.' });
  }
});

// GET /api/emails/:id?email= — the whole thread, marks this email read.
router.get('/:id', async (req, res) => {
  try {
    const caller = await resolveCaller(req.query.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const emailId = oid(req.params.id);
    const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId });
    if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." });

    const email = await Email.findById(emailId).lean();
    if (!email) return res.status(404).json({ error: 'Email not found.' });

    if (!mailboxRow.is_read) {
      mailboxRow.is_read = true;
      mailboxRow.read_at = new Date();
      await mailboxRow.save();
    }

    const thread = await Email.find({ thread_id: email.thread_id }).sort({ email_created_at: 1 }).lean();
    const userIds = new Set();
    thread.forEach((e) => {
      userIds.add(String(e.sender_id));
      e.recipient_ids.forEach((id) => userIds.add(String(id)));
    });
    const displayInfo = await userDisplayInfo([...userIds]);
    const patientName = await patientNameById(email.patient_id);

    const messages = thread.map((e) => ({
      id: String(e._id),
      sender: displayInfo.get(String(e.sender_id)) || { name: 'Unknown' },
      recipients: e.recipient_ids.map((id) => displayInfo.get(String(id)) || { name: 'Unknown' }),
      subject: e.subject,
      body: e.body,
      attachments: e.attachments.map((a, i) => ({ index: i, file_name: a.file_name, file_type: a.file_type, file_size: a.file_size })),
      email_status: e.email_status,
      email_sent_at: e.email_sent_at,
      email_created_at: e.email_created_at,
    }));

    return res.status(200).json({
      threadId: String(email.thread_id),
      patientName,
      isStarred: mailboxRow.is_starred,
      folder: mailboxRow.folder,
      messages,
    });
  } catch (err) {
    console.error('GET /api/emails/:id error:', err);
    return res.status(500).json({ error: err.message || 'Could not load email.' });
  }
});

// PATCH /api/emails/:id — { email, is_starred } | { email, folder:'trash' } | { email, restore:true }
router.patch('/:id', async (req, res) => {
  try {
    const caller = await resolveCaller(req.body.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const emailId = oid(req.params.id);
    const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId });
    if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." });

    if (typeof req.body.is_starred === 'boolean') {
      mailboxRow.is_starred = req.body.is_starred;
    }
    if (req.body.folder === 'trash') {
      mailboxRow.previous_folder = mailboxRow.folder;
      mailboxRow.folder = 'trash';
      mailboxRow.deleted_at = new Date();
    }
    if (req.body.restore) {
      mailboxRow.folder = mailboxRow.previous_folder || 'inbox';
      mailboxRow.previous_folder = null;
      mailboxRow.deleted_at = null;
    }
    await mailboxRow.save();

    return res.status(200).json({ mailboxRow });
  } catch (err) {
    console.error('PATCH /api/emails/:id error:', err);
    return res.status(500).json({ error: err.message || 'Could not update email.' });
  }
});

// DELETE /api/emails/:id?email= — permanently remove only from trash.
router.delete('/:id', async (req, res) => {
  try {
    const caller = await resolveCaller(req.query.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const emailId = oid(req.params.id);
    const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId });
    if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." });
    if (mailboxRow.folder !== 'trash') {
      return res.status(400).json({ error: 'Move the email to trash before deleting it permanently.' });
    }

    await EmailMailbox.deleteOne({ _id: mailboxRow._id });

    const remaining = await EmailMailbox.countDocuments({ email_id: emailId });
    if (remaining === 0) {
      const email = await Email.findById(emailId);
      if (email) {
        await deleteAttachmentFiles(email.attachments);
        await Email.deleteOne({ _id: emailId });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/emails/:id error:', err);
    return res.status(500).json({ error: err.message || 'Could not delete email.' });
  }
});

// GET /api/emails/:id/attachments/:index?email= — short-lived signed URL.
router.get('/:id/attachments/:index', async (req, res) => {
  try {
    const caller = await resolveCaller(req.query.email);
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' });

    const emailId = oid(req.params.id);
    const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId });
    if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." });

    const email = await Email.findById(emailId).lean();
    const attachment = email?.attachments?.[Number(req.params.index)];
    if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.file_path, 60);
    if (error) throw new Error(error.message);

    return res.status(200).json({ url: data.signedUrl, file_name: attachment.file_name });
  } catch (err) {
    console.error('GET /api/emails/:id/attachments/:index error:', err);
    return res.status(500).json({ error: err.message || 'Could not get attachment.' });
  }
});

module.exports = router;
