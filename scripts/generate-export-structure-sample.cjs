const XLSX = require('xlsx');

const vacanciesColumns = [
  'id','deletedAt','createdAt','updatedAt','archivedAt','closedAt','company','position','domain','location','headquarters',
  'modality','employmentType','seniority','techStack','salaryText','salaryMin','salaryMax','salaryCurrency','offerSource',
  'sourceType','offerUrl','companyUrl','contactName','contactEmail','contactLinkedin','lastContactAt','applicationStatus',
  'processStage','companyResponse','priority','discoveredAt','applicationDate','lastStatusChangeAt','nextFollowUpDate',
  'followUpPending','favorite','archived','rejectionReason','closureReason','notes','hrObservations','tags'
];

const eventsColumns = [
  'id','deletedAt','vacancyId','type','title','description','previousStatus','newStatus','eventAt','createdAt','actorType','actorId',
  'metadata.contactName','metadata.companyResponse','metadata.interviewType','metadata.interviewResult','metadata.followUpDate',
  'metadata.offerUrl','metadata.messageSnapshot','metadata.rejectionReason','metadata.attachments','metadata.customFields'
];

const followUpsColumns = [
  'id','vacancyId','plannedDate','completedAt','status','channel','subject','message','responseReceived','responseSummary','createdAt','updatedAt'
];

const vacancy = {
  id: 'vac_fake_001',
  deletedAt: null,
  createdAt: '2026-04-20T09:00:00.000Z',
  updatedAt: '2026-04-20T09:00:00.000Z',
  archivedAt: null,
  closedAt: null,
  company: 'FAKE Acme Cloud',
  position: '[FAKE] Backend Developer',
  domain: 'backend',
  location: 'Madrid, Spain',
  headquarters: 'Madrid',
  modality: 'hybrid',
  employmentType: 'full_time',
  seniority: 'mid',
  techStack: JSON.stringify(['Node.js', 'TypeScript', 'PostgreSQL']),
  salaryText: '45k - 55k EUR',
  salaryMin: 45000,
  salaryMax: 55000,
  salaryCurrency: 'EUR',
  offerSource: 'LinkedIn',
  sourceType: 'job_board',
  offerUrl: 'https://example.com/job/fake-backend',
  companyUrl: 'https://example.com',
  contactName: 'Jane Recruiter',
  contactEmail: 'jane@example.com',
  contactLinkedin: 'https://linkedin.com/in/jane-recruiter',
  lastContactAt: '2026-04-20T09:10:00.000Z',
  applicationStatus: 'applied',
  processStage: 'Application submitted',
  companyResponse: 'pending',
  priority: 'medium',
  discoveredAt: '2026-04-19T18:00:00.000Z',
  applicationDate: '2026-04-20T09:05:00.000Z',
  lastStatusChangeAt: '2026-04-20T09:05:00.000Z',
  nextFollowUpDate: '2026-04-27T09:00:00.000Z',
  followUpPending: true,
  favorite: false,
  archived: false,
  rejectionReason: null,
  closureReason: null,
  notes: 'Fake sample vacancy used to document export format.',
  hrObservations: null,
  tags: JSON.stringify(['fake', 'sample', 'backend'])
};

const event = {
  id: 'evt_fake_001',
  deletedAt: null,
  vacancyId: 'vac_fake_001',
  type: 'applied',
  title: 'Application sent',
  description: 'Candidate applied via LinkedIn.',
  previousStatus: 'saved',
  newStatus: 'applied',
  eventAt: '2026-04-20T09:05:00.000Z',
  createdAt: '2026-04-20T09:05:00.000Z',
  actorType: 'user',
  actorId: null,
  'metadata.contactName': 'Jane Recruiter',
  'metadata.companyResponse': 'pending',
  'metadata.interviewType': null,
  'metadata.interviewResult': null,
  'metadata.followUpDate': '2026-04-27T09:00:00.000Z',
  'metadata.offerUrl': 'https://example.com/job/fake-backend',
  'metadata.messageSnapshot': 'Hello, I am interested in this role...',
  'metadata.rejectionReason': null,
  'metadata.attachments': JSON.stringify(['cv_fake_backend.pdf', 'cover_letter_fake.pdf']),
  'metadata.customFields': JSON.stringify({ contactChannel: 'linkedin' })
};

const followUp = {
  id: 'fol_fake_001',
  vacancyId: 'vac_fake_001',
  plannedDate: '2026-04-27T09:00:00.000Z',
  completedAt: null,
  status: 'pending',
  channel: 'linkedin',
  subject: 'Follow-up FAKE Acme Cloud',
  message: 'Quick follow-up on my backend application.',
  responseReceived: false,
  responseSummary: '',
  createdAt: '2026-04-20T09:06:00.000Z',
  updatedAt: '2026-04-20T09:06:00.000Z'
};

function toOrderedRow(columns, source) {
  const row = {};
  for (const col of columns) {
    row[col] = Object.prototype.hasOwnProperty.call(source, col) ? source[col] : null;
  }
  return row;
}

const wb = XLSX.utils.book_new();
const vacanciesSheet = XLSX.utils.json_to_sheet([toOrderedRow(vacanciesColumns, vacancy)], { header: vacanciesColumns });
const eventsSheet = XLSX.utils.json_to_sheet([toOrderedRow(eventsColumns, event)], { header: eventsColumns });
const followUpsSheet = XLSX.utils.json_to_sheet([toOrderedRow(followUpsColumns, followUp)], { header: followUpsColumns });

XLSX.utils.book_append_sheet(wb, vacanciesSheet, 'Vacancies');
XLSX.utils.book_append_sheet(wb, eventsSheet, 'Events');
XLSX.utils.book_append_sheet(wb, followUpsSheet, 'FollowUps');

XLSX.writeFile(wb, 'src/assets/mocks/vacancies_export_structure_sample.xlsx');
console.log('Generated: src/assets/mocks/vacancies_export_structure_sample.xlsx');
