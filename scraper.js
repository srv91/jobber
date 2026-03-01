const fs = require('fs');
const cheerio = require('cheerio');

const JOB_SOURCES = [
  { id: 'sunlife', name: 'SunLife', type: 'workday', api: 'https://sunlife.wd3.myworkdayjobs.com/wday/cxs/sunlife/Experienced-Jobs/jobs', base: 'https://sunlife.wd3.myworkdayjobs.com/Experienced-Jobs' },
  { id: 'agf', name: 'AGF', type: 'workday', api: 'https://agf.wd3.myworkdayjobs.com/wday/cxs/agf/AGF_Careers/jobs', base: 'https://agf.wd3.myworkdayjobs.com/AGF_Careers' },
  { id: 'fidelity', name: 'Fidelity', type: 'workday', api: 'https://fil.wd3.myworkdayjobs.com/wday/cxs/fil/fidelitycanada/jobs', base: 'https://fil.wd3.myworkdayjobs.com/fidelitycanada' },
  { id: 'imco', name: 'IMCO', type: 'workday', api: 'https://imcoinvest.wd3.myworkdayjobs.com/wday/cxs/imcoinvest/IMCO/jobs', base: 'https://imcoinvest.wd3.myworkdayjobs.com/IMCO' },
  { id: 'optrust', name: 'OP Trust', type: 'workday', api: 'https://optrust.wd3.myworkdayjobs.com/wday/cxs/optrust/OPTrust/jobs', base: 'https://optrust.wd3.myworkdayjobs.com/OPTrust' },
  { id: 'aviva', name: 'Aviva', type: 'workday', api: 'https://aviva.wd1.myworkdayjobs.com/wday/cxs/aviva/External/jobs', base: 'https://aviva.wd1.myworkdayjobs.com/External' },
  { id: 'blackrock', name: 'BlackRock', type: 'html', url: 'https://careers.blackrock.com/location/toronto-jobs/45831/6251999-6093943-6167865/4' },
  { id: 'canadalife', name: 'Canada Life', type: 'html', url: 'https://jobs.canadalife.com/go/All-Jobs/9170201/' },
  { id: 'cibcmellon', name: 'CIBC Mellon', type: 'html', url: 'https://clients.njoyn.com/cl2/xweb/xweb.asp?clid=51330&page=joblisting' },
];

async function scrapeWorkday(source) {
  var allJobs = [];
  var offset = 0;
  var total = 0;
  
  do {
    const response = await fetch(source.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ limit: 20, offset: offset, appliedFacets: {} })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.jobPostings) break;
    total = data.total || 0;
    for (var i = 0; i < data.jobPostings.length; i++) {
      var job = data.jobPostings[i];
      allJobs.push({
        title: job.title || 'Untitled',
        url: source.base + (job.externalPath || ''),
        location: job.locationsText || 'Not specified',
        department: (job.bulletFields && job.bulletFields[0]) || 'General',
        postedDate: job.postedOn || new Date().toISOString().split('T')[0]
      });
    }
    offset += 20;
    if (data.jobPostings.length < 20) break;
    await new Promise(function(r) { setTimeout(r, 200); });
  } while (offset < total && offset < 200);
  
  return allJobs;
}

async function scrapeHtml(source) {
  const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const html = await response.text();
  const $ = cheerio.load(html);
  const jobs = [];
  if (source.id === 'blackrock') {
    $('a[href*="/job/toronto/"]').each(function() {
      const href = $(this).attr('href');
      const title = $(this).text().trim();
      if (href && title && title.length > 3) {
        jobs.push({ title: title, url: 'https://careers.blackrock.com' + href, location: 'Toronto', department: 'General', postedDate: new Date().toISOString().split('T')[0] });
      }
    });
  }
  if (source.id === 'canadalife') {
    $('table tr').each(function() {
      const link = $(this).find('a[href*="/job/"]');
      if (link.length) {
        jobs.push({ title: link.text().trim(), url: 'https://jobs.canadalife.com' + link.attr('href'), location: $(this).find('td').eq(1).text().trim() || 'Canada', department: $(this).find('td').eq(3).text().trim() || 'General', postedDate: $(this).find('td').eq(2).text().trim() || new Date().toISOString().split('T')[0] });
      }
    });
  }
  if (source.id === 'cibcmellon') {
    $('table tr').each(function() {
      const link = $(this).find('a[href*="JobDetails"]');
      if (link.length) {
        jobs.push({ title: link.attr('title') || link.text().trim(), url: 'https://clients.njoyn.com/cl2/xweb/' + link.attr('href'), location: $(this).find('td').eq(3).text().trim() || 'Toronto', department: $(this).find('td').eq(2).text().trim() || 'General', postedDate: new Date().toISOString().split('T')[0] });
      }
    });
  }
  return jobs;
}

async function main() {
  console.log('Starting job scraper...\n');
  var results = { lastUpdated: new Date().toISOString(), sources: [] };
  for (var i = 0; i < JOB_SOURCES.length; i++) {
    var source = JOB_SOURCES[i];
    process.stdout.write(source.name + '... ');
    var jobs = [];
    try {
      if (source.type === 'workday') jobs = await scrapeWorkday(source);
      else if (source.type === 'html') jobs = await scrapeHtml(source);
      console.log(jobs.length + ' jobs');
    } catch (err) {
      console.log('Error: ' + err.message);
    }
    results.sources.push({ id: source.id, name: source.name, url: source.api || source.url, jobCount: jobs.length, jobs: jobs });
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  fs.writeFileSync('jobs.json', JSON.stringify(results, null, 2));
  var total = 0;
  for (var j = 0; j < results.sources.length; j++) total += results.sources[j].jobCount;
  console.log('\nDone! Saved ' + total + ' jobs to jobs.json');
}

main();
