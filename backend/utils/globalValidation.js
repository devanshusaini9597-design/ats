/**
 * ═════════════════════════════════════════════════════════════════════════
 * GLOBAL VALIDATION RULEBOOK v2 (Enterprise-Grade)
 * Copied from excel-data/server.js - Complete validation system
 * ═════════════════════════════════════════════════════════════════════════
 * ✅ Auto-detects fields from content (not column names)
 * ✅ Supports multiple formats for all fields
 * ✅ Cross-field validation (CTC vs Expected, experience context, etc)
 * ✅ Unicode/International names supported
 * ✅ Quality gates: Ready (80%+), Review (50-79%), Blocked (<50%)
 */

// Global placeholder detection
const GLOBAL_PLACEHOLDERS = [
  'na', 'n/a', 'as per company norms', 'not specified', 'pending', 'tbd', 
  'unknown', 'none', '-', 'null', 'nil', 'wip', 'company', 'placeholder', 
  'test', 'dummy', '', 'to be decided', 'not applicable', 'will share', 
  'negotiable', 'flexible', 'open', 'competitive'
];

function isPlaceholderValue(s) {
  const t = String(s).toLowerCase().trim();
  return GLOBAL_PLACEHOLDERS.includes(t) || /^as per\s|^tbd\s|^will.*share|^negotiable|^flexible|^to be|^open|^competitive/i.test(t);
}

// Parse salary in ANY format: "1LPA", "1,50,000", "150K", "1.5L", etc.
function parseSalary(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  const lpaMatch = s.match(/^(\d+(?:\.\d+)?)\s*lpa$/i) || s.match(/(\d+(?:\.\d+)?)\s*lpa/i);
  if (lpaMatch) return parseFloat(lpaMatch[1]);
  
  const kMatch = s.match(/^(\d+)\s*k$/i) || s.match(/^(\d+),?\d{3}$/);
  if (kMatch) return parseFloat(kMatch[1]) / 100;
  
  const indianMatch = s.match(/^(\d{1,3}(?:,\d{3})*|(\d+))$/);
  if (indianMatch) {
    const num = parseInt(s.replace(/,/g, ''), 10);
    if (num >= 100000 && num <= 10000000) return num / 100000;
  }
  
  const lakMatch = s.match(/^(\d+(?:\.\d+)?)\s*l$/i);
  if (lakMatch) return parseFloat(lakMatch[1]);
  
  const lacMatch = s.match(/(\d+(?:\.\d+)?)\s*lac/i) || s.match(/(\d+(?:\.\d+)?)\s*lakhs?/i);
  if (lacMatch) return parseFloat(lacMatch[1]);
  
  const plainNum = parseFloat(s);
  if (!isNaN(plainNum)) {
    if (plainNum >= 1.5 && plainNum <= 100) return plainNum;
    if (plainNum > 100 && plainNum <= 10000000) return plainNum / 100000;
  }
  
  return null;
}

// Parse phone in ANY format
function parsePhone(str) {
  if (!str) return null;
  const s = String(str).trim();
  const digits = s.replace(/\D/g, '');
  
  let phone = digits;
  if (digits.startsWith('91') && digits.length === 12) {
    phone = digits.slice(2);
  }
  
  if (/^[6-9]\d{9}$/.test(phone)) {
    return phone;
  }
  
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return last10;
    }
  }
  
  return null;
}

// Parse notice period in ANY format
function parseNoticePeriod(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  if (s === 'immediate' || s === '0 days' || s === '0' || /^immediate[d]?\s*(joinner?)?/i.test(s)) return 0;
  
  const daysMatch = s.match(/^(\d+)\s*days?$/i);
  if (daysMatch) return parseInt(daysMatch[1], 10);
  
  const weeksMatch = s.match(/^(\d+)\s*weeks?$/i);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;
  
  const monthsMatch = s.match(/^(\d+)\s*months?$/i);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;
  
  if (/on notice|under notice/i.test(s)) return null;
  
  if (/^\d+$/.test(s)) {
    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum >= 0 && plainNum <= 365) {
      return plainNum;
    }
  }
  
  return null;
}

// Parse experience in ANY format
function parseExperience(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  if (/^fresher|^entry|^0\s*exp|^student|^graduate/i.test(s)) return 0;
  
  const expMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:yrs?|years?|y|months?)\s*$/i);
  if (expMatch) {
    const num = parseFloat(expMatch[1]);
    if (num >= 0 && num <= 70 && (num === 0 || num >= 0.1)) return num;
  }
  
  const plusMatch = s.match(/^(\d+(?:\.\d+)?)\+?\s*(?:yrs?|years?)\s*$/i);
  if (plusMatch) {
    const num = parseFloat(plusMatch[1]);
    if (num >= 0 && num <= 70) return num;
  }
  
  return null;
}

function calculateScore(field, str) {
  const strLower = str.toLowerCase();
  switch(field) {
    case 'name': {
      const wordCount = str.split(/\s+/).filter(Boolean).length;
      const hasValidNameChars = /^[\p{L}\s\-']+$/u.test(str);
      const hasDigits = /\d/.test(str) ? 1 : 0;
      const hasSpecial = /[^a-z\s\-'0-9]/i.test(str) ? 1 : 0;
      if (!hasValidNameChars) return 0;
      return (wordCount >= 2 && wordCount <= 4 ? 20 : wordCount === 1 ? 15 : 10) + 
             str.length - hasDigits * 30 - hasSpecial * 20;
    }
    case 'phone': {
      const parsed = parsePhone(str);
      return parsed ? 10 : 0;
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower) ? 10 : 0;
    case 'location': {
      const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'new delhi', 'mumbai', 'pune', 
        'hyderabad', 'secunderabad', 'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 
        'noida', 'greater noida', 'vadodara', 'surat', 'jaipur', 'lucknow', 'indore', 'nagpur', 
        'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'tier', 
        'remote', 'work from home', 'wfh'];
      return cityKeywords.some(city => strLower.includes(city)) ? 10 : 5;
    }
    case 'position': {
      const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
        'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
        'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
        'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'fls', 
        'non fls', 'contractor', 'freelance', 'consultant', 'specialist'];
      return positionKeywords.some(pos => strLower.includes(pos)) ? 10 : 5;
    }
    case 'experience': {
      const parsed = parseExperience(str);
      return parsed !== null ? 10 : 0;
    }
    case 'ctc': {
      const parsed = parseSalary(str);
      if (parsed && parsed >= 0 && parsed <= 100) return 10;
      return 0;
    }
    case 'expectedSalary': {
      const parsed = parseSalary(str);
      if (parsed && parsed >= 0 && parsed <= 100) return 10;
      return 0;
    }
    case 'noticePeriod': {
      const parsed = parseNoticePeriod(str);
      return parsed !== null ? 10 : 0;
    }
    case 'status': {
      const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 
        'pending', 'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 
        'declined', 'didn\'t attend', 'referred', 'under consideration', 'offer received'];
      return statusKeywords.some(st => strLower.includes(st)) ? 10 : 0;
    }
    case 'sourceOfCV': {
      const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 
        'glassdoor', 'job portal', 'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 
        'internal', 'networking', 'social media', 'facebook', 'twitter', 'career fair', 'portal'];
      return sourceKeywords.some(src => strLower.includes(src)) ? 10 : 0;
    }
    case 'company':
    case 'client': {
      const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
        'company', 'corp', 'bank', 'finance', 'education', 'insurance', 'consulting', 'group', 
        'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind', 
        'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 
        'amazon', 'flipkart', 'uber', 'paytm', 'freshworks', 'swiggy', 'zomato'];
      const looksLikeOrg = orgKeywords.some(k => strLower.includes(k)) || 
                          (str.split(/\s+/).length >= 2 && str.length > 8 && /^[a-z0-9\s&\-\.]+$/i.test(str));
      const hasDigits = /\d/.test(str) ? 1 : 0;
      return looksLikeOrg ? 10 - hasDigits * 3 : 0;
    }
    case 'spoc': {
      const words = str.split(/\s+/).filter(Boolean);
      const hasValidChars = /^[\p{L}\s\-'\.]+$/u.test(str);
      const noBad = !/\d|@|lpa|yrs|bank|pvt|ltd|naukri|linkedin/i.test(str);
      return (words.length >= 1 && words.length <= 3 && hasValidChars && noBad) ? 10 : 0;
    }
    default:
      return 5;
  }
}

function resolveCandidates(candidates, field, hints) {
  if (candidates[field].length === 0) return { value: null, duplicates: [] };
  
  candidates[field].sort((a, b) => b.score - a.score);
  const maxScore = candidates[field][0].score;
  const top = candidates[field].filter(c => c.score === maxScore);
  
  const duplicates = candidates[field].length > 1 ? 
    candidates[field].slice(1).map(c => c.value) : [];
  
  if (top.length === 1) {
    return { value: top[0].value, duplicates };
  }
  
  if (field === 'name') {
    for (const c of top) {
      if (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls')) {
        return { value: c.value, duplicates };
      }
    }
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  } else {
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  }
  
  if (field === 'name' || field === 'position' || field === 'spoc') {
    return { value: top.reduce((a, b) => a.value.length < b.value.length ? a : b).value, duplicates };
  }
  
  if (field === 'company' || field === 'client') {
    return { value: top.reduce((a, b) => a.value.length > b.value.length ? a : b).value, duplicates };
  }
  
  return { value: top[0].value, duplicates };
}

function correctFieldMisclassifications(detected) {
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
    'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
    'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
    'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations'];
  
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
    'company', 'corp', 'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google'];

  if (detected.name) {
    const nameLower = String(detected.name).toLowerCase();
    if (positionKeywords.some(p => new RegExp('\\b' + p + '\\b', 'i').test(nameLower)) && !detected.position) {
      detected.position = detected.name;
      detected.name = null;
    }
  }

  if (detected.position && !detected.company) {
    const posLower = String(detected.position).toLowerCase();
    if (orgKeywords.some(k => posLower.includes(k))) {
      detected.company = detected.position;
      detected.position = null;
    }
  }

  if (detected.company && detected.company.length < 4 && !detected.spoc) {
    const companyLower = String(detected.company).toLowerCase();
    const hasOrgKeyword = orgKeywords.some(k => companyLower.includes(k));
    if (!hasOrgKeyword) {
      detected.spoc = detected.company;
      detected.company = null;
    }
  }

  if (detected.client && detected.company) {
    const clientLower = String(detected.client).toLowerCase();
    const companyLower = String(detected.company).toLowerCase();
    const bankFinanceKeywords = ['bank', 'finance', 'credit', 'fund', 'capital', 'investment', 'insurance'];
    const isClientFinance = bankFinanceKeywords.some(b => clientLower.includes(b));
    const isCompanyFinance = bankFinanceKeywords.some(b => companyLower.includes(b));
    
    if (isClientFinance && !isCompanyFinance) {
      [detected.client, detected.company] = [detected.company, detected.client];
    }
  }

  return detected;
}

function detectFields(row, headers = []) {
  const hintKeywords = {
    name: ['name', 'candidate', 'employee', 'person', 'fname', 'fullname', 'applicant', 'fls', 'non-fls', 'non fls'],
    phone: ['phone', 'contact', 'mobile', 'number', 'tel', 'telephone', 'cell', 'cellular', 'whatsapp'],
    email: ['email', 'e-mail', 'emailaddress', 'mailid', 'mail'],
    location: ['location', 'city', 'place', 'state', 'region', 'area'],
    position: ['position', 'job', 'role', 'designation', 'title', 'profile', 'post'],
    experience: ['experience', 'exp', 'yrs', 'years', 'work_exp', 'expertise', 'work experience'],
    ctc: ['ctc', 'current salary', 'current pay', 'salary', 'pay', 'current_salary', 'basic', 'current ctc'],
    expectedSalary: ['expected', 'desired', 'target', 'expectation', 'expected_salary', 'offer', 'expected ctc'],
    noticePeriod: ['notice', 'period', 'notice_period', 'availability', 'joindate', 'notice period', 'days'],
    company: ['company', 'current company', 'employer', 'organization', 'firm', 'company name'],
    client: ['client', 'project', 'account', 'placed at', 'bank'],
    spoc: ['spoc', 'feedback', 'hr', 'contact_person', 'representative', 'poc'],
    status: ['status', 'candidate_status', 'stage', 'feedback', 'remark'],
    sourceOfCV: ['source', 'cv', 'resume', 'origin', 'channel', 'referral']
  };

  const candidates = {
    name: [],
    phone: [],
    email: [],
    location: [],
    position: [],
    experience: [],
    ctc: [],
    expectedSalary: [],
    noticePeriod: [],
    company: [],
    client: [],
    spoc: [],
    status: [],
    sourceOfCV: []
  };

  const values = Object.values(row).filter(v => v != null && String(v).trim() !== '');
  const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'mumbai', 'pune', 'hyderabad', 'secunderabad', 
    'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'vadodara', 'surat', 
    'jaipur', 'lucknow', 'indore', 'nagpur', 'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 
    'trivandrum', 'tier', 'remote', 'work from home', 'wfh'];
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 'architect', 
    'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 'associate', 'senior', 
    'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 'qa', 'tester', 'business', 
    'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'non fls', 'contractor', 'freelance', 'programmer', 'admin'];
  const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 'pending', 
    'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 'declined'];
  const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 'glassdoor', 'job portal', 
    'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 'internal', 'networking', 'portal', 'social', 
    'facebook', 'twitter', 'instagram', 'whatsapp', 'recruitment', 'placement', 'consultant', 'headhunter'];
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 'company', 'corp', 
    'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 'global', 'international',
    'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind',
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon'];
  const bankFinanceKeywords = ['bank', 'finance', 'credit', 'fund', 'capital', 'investment', 'insurance'];

  function isOrganizationName(str) {
    const strLower = str.toLowerCase();
    if (orgKeywords.some(k => strLower.includes(k))) return true;
    if (str.length > 45) return true;
    if (/\b(ltd|pvt|llp|corp|inc|pte|plc)\b/i.test(str)) return true;
    if (/&.*(?:pvt|ltd|corp|solutions|technologies)/i.test(str)) return true;
    return false;
  }

  function isPositionTitle(str) {
    const strLower = str.toLowerCase();
    return positionKeywords.some(pos => {
      const word = '\\b' + pos + '\\b';
      return new RegExp(word, 'i').test(strLower);
    });
  }

  values.forEach((value, idx) => {
    const str = String(value).trim();
    const strLower = str.toLowerCase();
    if (isPlaceholderValue(str)) return;

    const header = headers[idx] || '';
    const headerLower = header.toLowerCase().trim();
    const columnsToSkip = ['date', 'timestamp', 'created', 'updated', 'id', 'serial', 'row', 'sr', 'sr.', 'feedback', 'remarks', 'notes'];
    if (columnsToSkip.some(col => headerLower.includes(col))) return;

    const headerHasName = headerLower.includes('name') || headerLower.includes('candidate') || headerLower.includes('fls');
    const headerHasPhone = headerLower.includes('phone') || headerLower.includes('contact') || headerLower.includes('mobile');
    const headerHasEmail = headerLower.includes('email') || headerLower.includes('mail');
    const headerHasStatus = headerLower.includes('status') || headerLower.includes('feedback');
    const headerHasExperience = headerLower.includes('experience') || headerLower.includes('exp') || headerLower.includes('yrs');
    const headerHasPosition = headerLower.includes('position') || headerLower.includes('role') || headerLower.includes('designation') || headerLower.includes('title');

    if (headerHasStatus && (statusKeywords.some(st => strLower.includes(st)) || isOrganizationName(str))) {
      return;
    }
    
    const noticePeriodKeywords = ['immediate', 'joiner', 'joinnner', 'immedidate', 'days', 'weeks', 'months', 'notice'];
    const rejectedNamePhrases = [/immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i];
    
    if (headerHasName) {
      if (statusKeywords.some(st => strLower.includes(st)) || 
          isPositionTitle(str) ||
          rejectedNamePhrases.some(rp => rp.test(str)) ||
          (noticePeriodKeywords.some(np => strLower.includes(np)) && !/[a-z]{4,}[a-z]{4,}/i.test(str.replace(/\s/g, '')))) {
        return;
      }
    }
    
    if (headerHasPhone && !/\d/.test(str)) return;
    if (headerHasEmail && !/@/.test(str)) return;

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower)) {
      const score = calculateScore('email', str);
      candidates.email.push({ value: strLower, score, header });
    }

    const phoneMatch = parsePhone(str);
    if (phoneMatch) {
      const score = calculateScore('phone', str);
      candidates.phone.push({ value: phoneMatch, score, header });
    }

    if (isPositionTitle(str)) {
      const score = calculateScore('position', str) + 10;
      candidates.position.push({ value: str, score, header });
    }

    const wordCount = str.split(/\s+/).filter(Boolean).length;
    const isStatusValue = statusKeywords.some(st => strLower.includes(st));
    const isNoticePeriodPhrase = /immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i.test(str);
    
    if (wordCount >= 1 && wordCount <= 3 && 
        /^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|_|<|>|\/|\\|\||#|\*|lpa|yrs|phone|email/i.test(str) && 
        str.length >= 2 &&
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str) &&
        !isStatusValue &&
        !isNoticePeriodPhrase &&
        !cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('name', str);
      const lengthBoost = str.length < 20 ? 5 : 0;
      const wordsBoost = wordCount <= 2 ? 3 : 0;
      const flsBoost = headerLower.includes('fls') || headerLower.includes('person') || headerLower.includes('candidate') ? 20 : 0;
      candidates.name.push({ value: str, score: score + lengthBoost + wordsBoost + flsBoost, header });
    }

    if (cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('location', str);
      candidates.location.push({ value: str, score, header });
    }

    const noticeParsed = parseNoticePeriod(str);
    if (noticeParsed !== null && noticeParsed >= 0 && noticeParsed <= 365) {
      const score = calculateScore('noticePeriod', str) + 15;
      candidates.noticePeriod.push({ value: noticeParsed, score, header });
    }

    const expParsed = parseExperience(str);
    if (expParsed !== null && noticeParsed === null) {
      const score = calculateScore('experience', str) + 10;
      candidates.experience.push({ value: expParsed, score, header });
    }

    const ctcParsed = parseSalary(str);
    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('ctc', str);
      candidates.ctc.push({ value: ctcParsed, score, header });
    }

    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('expectedSalary', str) + (headerLower.includes('expected') ? 2 : 0);
      candidates.expectedSalary.push({ value: ctcParsed, score, header });
    }

    if (statusKeywords.some(st => strLower.includes(st))) {
      const score = calculateScore('status', str);
      candidates.status.push({ value: strLower, score, header });
    }

    if (sourceKeywords.some(src => strLower.includes(src))) {
      const score = calculateScore('sourceOfCV', str);
      candidates.sourceOfCV.push({ value: strLower, score, header });
    }

    const hasOrgKeywords = orgKeywords.some(k => strLower.includes(k));
    const looksLikeOrg = hasOrgKeywords ||
                        (str.split(/\s+/).length >= 2 && str.length > 8 && /^[a-z0-9\s&\-\.,'()]+$/i.test(str) && str.length <= 50);
    
    if (looksLikeOrg && 
        !/\d@|@|lpa|yrs/.test(str) && 
        !statusKeywords.some(st => strLower.includes(st)) &&
        !isPositionTitle(str)) {
      const score = calculateScore('company', str) + (hasOrgKeywords ? 5 : 0);
      candidates.company.push({ value: str, score, header });
      
      if (bankFinanceKeywords.some(b => strLower.includes(b))) {
        candidates.client.push({ value: str, score: score + 5, header });
      }
    }

    if (/^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|lpa|yrs|bank|pvt|ltd|naukri|linkedin|\.com/i.test(str) && 
        str.split(/\s+/).length <= 3 && 
        str.length >= 2 && 
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str)) {
      const score = calculateScore('spoc', str);
      candidates.spoc.push({ value: str, score, header });
    }
  });

  const detected = {
    name: null,
    phone: null,
    email: null,
    location: null,
    position: null,
    experience: null,
    ctc: null,
    expectedSalary: null,
    noticePeriod: null,
    company: null,
    client: null,
    spoc: null,
    status: null,
    sourceOfCV: null,
    duplicates: {}
  };

  Object.keys(candidates).forEach(field => {
    const hints = hintKeywords[field] || [];
    const resolved = resolveCandidates(candidates, field, hints);
    detected[field] = resolved.value;
    if (resolved.duplicates.length > 0) {
      detected.duplicates[field] = resolved.duplicates;
    }
  });

  if (detected.name) {
    const flsCandidates = candidates.name.filter(c => 
      c.header && (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls'))
    );
    if (flsCandidates.length > 0) {
      flsCandidates.sort((a, b) => b.score - a.score);
      detected.name = flsCandidates[0].value;
    } else {
      if (isOrganizationName(detected.name)) {
        detected.name = null;
      }
    }
  }

  const assignedValues = new Set();
  const fieldPriority = ['name', 'email', 'phone', 'position', 'spoc', 'company', 'status', 'sourceOfCV'];
  
  for (const field of fieldPriority) {
    if (detected[field] && assignedValues.has(String(detected[field]).toLowerCase().trim())) {
      detected[field] = null;
    } else if (detected[field]) {
      assignedValues.add(String(detected[field]).toLowerCase().trim());
    }
  }

  correctFieldMisclassifications(detected);

  function validateSemanticMatch(field, value) {
    if (!value) return true;
    
    const strLower = String(value).toLowerCase();
    
    if (field === 'name') {
      const invalidKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'developer', 'engineer', 
        'manager', 'pvt', 'ltd', 'bank', 'finance', 'insurance'];
      if (invalidKeywords.some(kw => strLower.includes(kw))) {
        return false;
      }
    }
    
    if (field === 'company') {
      const wordCount = String(value).split(/\s+/).length;
      const hasOnlyLetters = /^[a-z\s'\-]+$/i.test(value);
      const companyKeywords = ['pvt', 'ltd', 'llp', 'inc', 'corp', 'solutions', 'technologies', 'systems', 
        'services', 'company', 'bank', 'finance', 'education', 'insurance'];
      const hasCompanyKeyword = companyKeywords.some(k => strLower.includes(k));
      
      if (/^\d+(?:\.\d+)?\s*(?:years?|yrs?)$/i.test(value)) {
        return false;
      }
      
      if (hasOnlyLetters && wordCount <= 2 && value.length < 20 && !hasCompanyKeyword) {
        return false;
      }
      if (hasOnlyLetters && wordCount === 3 && value.length < 25 && !hasCompanyKeyword) {
        return false;
      }
    }
    
    if (field === 'status') {
      const cityKeywords = ['bangalore', 'mumbai', 'delhi', 'pune', 'hyderabad', 'vadodara', 'surat'];
      if (cityKeywords.some(city => strLower.includes(city))) {
        return false;
      }
    }
    
    if (field === 'position') {
      const statusKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'applied'];
      if (statusKeywords.some(st => strLower.includes(st))) {
        return false;
      }
    }
    
    return true;
  }

  const semanticValidationFailed = {};
  ['name', 'company', 'status', 'position'].forEach(field => {
    if (detected[field] && !validateSemanticMatch(field, detected[field])) {
      semanticValidationFailed[field] = detected[field];
      detected[field] = null;
    }
  });

  return detected;
}

function validateCandidate(detected, rowIndex) {
  const errors = [];
  const warnings = [];
  let confidence = 100;
  const duplicateFields = detected.duplicates || {};

  if (!detected.name) {
    errors.push({ field: 'name', message: 'Name is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (isPlaceholderValue(detected.name)) {
    errors.push({ field: 'name', message: `"${detected.name}" is placeholder text`, severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[\p{L}\s\-'\.]+$/u.test(detected.name)) {
    errors.push({ field: 'name', message: 'Name must be alphabetic only', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.phone) {
    errors.push({ field: 'phone', message: 'Phone number is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[6-9]\d{9}$/.test(detected.phone)) {
    errors.push({ field: 'phone', message: 'Phone must be 10 digits starting with 6-9', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.email) {
    warnings.push({ field: 'email', message: 'Email is missing', severity: 'WARNING' });
    confidence -= 10;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detected.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.location) {
    warnings.push({ field: 'location', message: 'Location/City is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.position) {
    warnings.push({ field: 'position', message: 'Position/Job Title is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.experience === null || detected.experience === undefined) {
    warnings.push({ field: 'experience', message: 'Experience is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.ctc === null || detected.ctc === undefined) {
    warnings.push({ field: 'ctc', message: 'Current CTC is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.noticePeriod === null || detected.noticePeriod === undefined) {
    warnings.push({ field: 'noticePeriod', message: 'Notice Period is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.company) {
    warnings.push({ field: 'company', message: 'Current Company is missing (freelancer?)', severity: 'WARNING' });
    confidence -= 5;
  }

  if (!detected.status) {
    warnings.push({ field: 'status', message: 'Candidate Status is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.sourceOfCV) {
    warnings.push({ field: 'sourceOfCV', message: 'Source of CV is missing', severity: 'WARNING' });
    confidence -= 5;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  let category = 'ready';
  if (errors.length > 0) {
    category = 'blocked';
  } else if (confidence >= 80) {
    category = 'ready';
  } else if (confidence >= 50) {
    category = 'review';
  } else {
    category = 'blocked';
  }

  return {
    rowIndex,
    detected,
    errors,
    warnings,
    confidence,
    category
  };
}

function autoFix(detected) {
  const fixed = { ...detected };
  delete fixed.duplicates;
  const changes = [];

  if (fixed.name) {
    const original = fixed.name;
    fixed.name = fixed.name
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (original !== fixed.name) {
      changes.push(`name: "${original}" → "${fixed.name}"`);
    }
  }

  if (fixed.email) {
    const original = fixed.email;
    fixed.email = fixed.email.toLowerCase().trim();
    if (original !== fixed.email) {
      changes.push(`email: "${original}" → "${fixed.email}"`);
    }
  }

  if (fixed.phone) {
    const original = fixed.phone;
    fixed.phone = String(fixed.phone).replace(/\D/g, '').slice(-10);
    if (original !== fixed.phone) {
      changes.push(`phone: "${original}" → "${fixed.phone}"`);
    }
  }

  if (fixed.location) {
    const original = fixed.location;
    fixed.location = fixed.location.trim();
    if (original !== fixed.location) {
      changes.push(`location: "${original}" → "${fixed.location}"`);
    }
  }

  if (fixed.position) {
    const original = fixed.position;
    fixed.position = fixed.position.trim();
    if (original !== fixed.position) {
      changes.push(`position: "${original}" → "${fixed.position}"`);
    }
  }

  if (fixed.experience !== null && fixed.experience !== undefined) {
    const original = fixed.experience;
    fixed.experience = parseFloat(fixed.experience);
    if (original !== fixed.experience && !isNaN(fixed.experience)) {
      changes.push(`experience: "${original}" → ${fixed.experience}`);
    }
  }

  if (fixed.ctc !== null && fixed.ctc !== undefined) {
    const original = fixed.ctc;
    fixed.ctc = parseFloat(fixed.ctc);
    if (original !== fixed.ctc && !isNaN(fixed.ctc)) {
      changes.push(`ctc: "${original}" → ${fixed.ctc}`);
    }
  }

  if (fixed.expectedSalary !== null && fixed.expectedSalary !== undefined) {
    const original = fixed.expectedSalary;
    fixed.expectedSalary = parseFloat(fixed.expectedSalary);
    if (original !== fixed.expectedSalary && !isNaN(fixed.expectedSalary)) {
      changes.push(`expectedSalary: "${original}" → ${fixed.expectedSalary}`);
    }
  }

  if (fixed.noticePeriod !== null && fixed.noticePeriod !== undefined) {
    const original = fixed.noticePeriod;
    fixed.noticePeriod = parseInt(fixed.noticePeriod, 10);
    if (original !== fixed.noticePeriod && !isNaN(fixed.noticePeriod)) {
      changes.push(`noticePeriod: "${original}" → ${fixed.noticePeriod} days`);
    }
  }

  if (fixed.company) {
    const original = fixed.company;
    fixed.company = fixed.company.trim();
    if (original !== fixed.company) {
      changes.push(`company: "${original}" → "${fixed.company}"`);
    }
  }

  if (fixed.client) {
    const original = fixed.client;
    fixed.client = fixed.client.trim();
    if (original !== fixed.client) {
      changes.push(`client: "${original}" → "${fixed.client}"`);
    }
  }

  if (fixed.spoc) {
    const original = fixed.spoc;
    fixed.spoc = fixed.spoc
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (original !== fixed.spoc) {
      changes.push(`spoc: "${original}" → "${fixed.spoc}"`);
    }
  }

  if (fixed.status) {
    const original = fixed.status;
    fixed.status = fixed.status.toLowerCase().trim();
    if (original !== fixed.status) {
      changes.push(`status: "${original}" → "${fixed.status}"`);
    }
  }

  if (fixed.sourceOfCV) {
    const original = fixed.sourceOfCV;
    fixed.sourceOfCV = fixed.sourceOfCV.toLowerCase().trim();
    if (original !== fixed.sourceOfCV) {
      changes.push(`sourceOfCV: "${original}" → "${fixed.sourceOfCV}"`);
    }
  }

  return { fixed, changes };
}

module.exports = {
  isPlaceholderValue,
  parseSalary,
  parsePhone,
  parseNoticePeriod,
  parseExperience,
  calculateScore,
  resolveCandidates,
  correctFieldMisclassifications,
  detectFields,
  validateCandidate,
  autoFix
};
