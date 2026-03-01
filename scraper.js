const fs = require('fs');
const cheerio = require('cheerio');

const JOB_SOURCES = [
  // === WORKDAY API ===
  { id: 'sunlife', name: 'SunLife', type: 'workday', api: 'https://sunlife.wd3.myworkdayjobs.com/wday/cxs/sunlife/Experienced-Jobs/jobs', base: 'https://sunlife.wd3.myworkdayjobs.com/Experienced-Jobs' },
  { id: 'agf', name: 'AGF', type: 'workday', api: 'https://agf.wd3.myworkdayjobs.com/wday/cxs/agf/AGF_Careers/jobs', base: 'https://agf.wd3.myworkdayjobs.com/AGF_Careers' },
  { id: 'fidelity', name: 'Fidelity', type: 'workday', api: 'https://fil.wd3.myworkdayjobs.com/wday/cxs/fil/fidelitycanada/jobs', base: 'https://fil.wd3.myworkdayjobs.com/fidelitycanada' },
  { id: 'imco', name: 'IMCO', type: 'workday', api: 'https://imcoinvest.wd3.myworkdayjobs.com/wday/cxs/imcoinvest/IMCO/jobs', base: 'https://imcoinvest.wd3.myworkdayjobs.com/IMCO' },
  { id: 'optrust', name: 'OP Trust', type: 'workday', api: 'https://optrust.wd3.myworkdayjobs.com/wday/cxs/optrust/OPTrust/jobs', base: 'https://optrust.wd3.myworkdayjobs.com/OPTrust' },
  { id: 'aviva', name: 'Aviva', type: 'workday', api: 'https://aviva.wd1.myworkdayjobs.com/wday/cxs/aviva/External/jobs', base: 'https://aviva.wd1.myworkdayjobs.com/External' },

  // === HTML (CHEERIO) ===
  { id: 'blackrock', name: 'BlackRock', type: 'html', url: 'https://careers.blackrock.com/location/toronto-jobs/45831/6251999-6093943-6167865/4' },
  { id: 'canadalife', name: 'Canada Life', type: 'html', url: 'https://jobs.canadalife.com/go/All-Jobs/9170201/' },
  { id: 'cibcmellon', name: 'CIBC Mellon', type: 'html', url: 'https://clients.njoyn.com/cl2/xweb/xweb.asp?clid=51330&page=joblisting' },

  // === ULTIPRO API ===
  { id: 'alterna', name: 'Alterna Savings', type: 'ultipro',
    api: 'https://recruiting.ultipro.ca/ALT5000ASCUL/JobBoard/5cf23382-2cd5-42f4-8a95-48fc4c5822db/JobBoardView/LoadSearchResults',
    base: 'https://recruiting.ultipro.ca/ALT5000ASCUL/JobBoard/5cf23382-2cd5-42f4-8a95-48fc4c5822db' },
  { id: 'meridian', name: 'Meridian', type: 'ultipro',
    api: 'https://recruiting.ultipro.ca/MER5001MCUL/JobBoard/6c1f133f-d0ac-48cd-a17d-bc54fe044ce3/JobBoardView/LoadSearchResults',
    base: 'https://recruiting.ultipro.ca/MER5001MCUL/JobBoard/6c1f133f-d0ac-48cd-a17d-bc54fe044ce3' },
  { id: 'cooperators', name: 'Cooperators', type: 'ultipro',
    api: 'https://recruiting.ultipro.com/COO5000COOP/JobBoard/163383cc-cbae-4201-956e-c5e437bbfeb3/JobBoardView/LoadSearchResults',
    base: 'https://recruiting.ultipro.com/COO5000COOP/JobBoard/163383cc-cbae-4201-956e-c5e437bbfeb3' },

  // === SAP SUCCESSFACTORS XML FEED ===
  { id: 'igm', name: 'IGM', type: 'xml',
    url: 'https://career17.sapsf.com/career?company=investorsgP&career_ns=job_listing_summary&resultType=XML',
    base: 'https://career17.sapsf.com/career?company=investorsgP&career_ns=job_listing&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=' },

  // === PUPPETEER (JS-RENDERED) ===
  { id: 'statestreet', name: 'State Street', type: 'puppeteer', url: 'https://careers.statestreet.com/global/en/search-results' },
  { id: 'raymondjames', name: 'Raymond James', type: 'puppeteer', url: 'https://raymondjames.taleo.net/careersection/1_ca/jobsearch.ftl?lang=en' },
  { id: 'mackenzie', name: 'Mackenzie', type: 'puppeteer', url: 'https://careersen-mackenzieinvestments.icims.com/jobs/search?ss=1' },
  { id: 'richardson', name: 'Richardson Wealth', type: 'puppeteer', url: 'https://jobs.dayforcehcm.com/en-CA/richardsonwealth/CANDIDATEPORTAL' },
  { id: 'iawealth', name: 'IA Wealth', type: 'puppeteer', url: 'https://ia.ca/jobs/jobs-available' },
];

// ==================== WORKDAY API ====================

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

// ==================== HTML (CHEERIO) ====================

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

// ==================== ULTIPRO API ====================

async function scrapeUltipro(source) {
  var allJobs = [];
  var offset = 0;
  var total = 0;

  do {
    var response = await fetch(source.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outLimit: 20,
        outOffset: offset,
        opportunitySearch: {
          Top: 20,
          Skip: offset,
          QueryString: '',
          OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }],
          Filters: []
        }
      })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    var data = await response.json();
    if (!data.opportunities || data.opportunities.length === 0) break;
    total = data.totalCount || 0;

    for (var i = 0; i < data.opportunities.length; i++) {
      var opp = data.opportunities[i];
      var location = 'Not specified';
      if (opp.Locations && opp.Locations.length > 0) {
        var loc = opp.Locations[0];
        if (loc.Address) {
          var parts = [loc.Address.City];
          if (loc.Address.State) parts.push(loc.Address.State.Name);
          location = parts.filter(Boolean).join(', ') || 'Not specified';
        }
        if (location === 'Not specified' && loc.LocalizedName) location = loc.LocalizedName;
      }
      allJobs.push({
        title: opp.Title || 'Untitled',
        url: source.base + '/OpportunityDetail?opportunityId=' + opp.Id,
        location: location,
        department: opp.JobCategoryName || 'General',
        postedDate: opp.PostedDate ? opp.PostedDate.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    }

    offset += 20;
    if (data.opportunities.length < 20) break;
    await new Promise(function(r) { setTimeout(r, 200); });
  } while (offset < total && offset < 200);

  return allJobs;
}

// ==================== SAP SUCCESSFACTORS XML ====================

async function scrapeIgmXml(source) {
  var response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  var xml = await response.text();
  var $ = cheerio.load(xml, { xmlMode: true });
  var jobs = [];

  $('Job').each(function() {
    var title = $(this).find('JobTitle').text().trim();
    var reqId = $(this).find('ReqId').text().trim();
    var postedDate = $(this).find('Posted-Date').text().trim();
    var location = $(this).find('mfield2').text().trim() || 'Canada';

    if (title) {
      var formattedDate = new Date().toISOString().split('T')[0];
      var dateParts = postedDate.split('/');
      if (dateParts.length === 3) {
        formattedDate = dateParts[2] + '-' + dateParts[0].padStart(2, '0') + '-' + dateParts[1].padStart(2, '0');
      }
      jobs.push({
        title: title,
        url: source.base + reqId,
        location: location,
        department: 'General',
        postedDate: formattedDate
      });
    }
  });

  return jobs;
}

// ==================== PUPPETEER (JS-RENDERED SITES) ====================

var browser = null;

async function getBrowser() {
  if (!browser) {
    var puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function scrapePuppeteer(source) {
  var b = await getBrowser();
  var page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    if (source.id === 'statestreet') return await scrapeStateStreet(page, source);
    if (source.id === 'raymondjames') return await scrapeRaymondJames(page, source);
    if (source.id === 'mackenzie') return await scrapeMackenzie(page, source);
    if (source.id === 'richardson') return await scrapeRichardson(page, source);
    if (source.id === 'iawealth') return await scrapeIaWealth(page, source);
    return [];
  } finally {
    await page.close();
  }
}

// --- State Street (Phenom People) ---

async function scrapeStateStreet(page, source) {
  await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 45000 });

  // Try extracting from Phenom DDO (embedded job data)
  var jobs = await page.evaluate(function() {
    var results = [];
    try {
      if (window.phApp && window.phApp.ddo) {
        var searchData = window.phApp.ddo.eagerLoadRefineSearch || window.phApp.ddo.refineSearch;
        if (searchData && searchData.data && searchData.data.jobs) {
          searchData.data.jobs.forEach(function(job) {
            results.push({
              title: job.title || 'Untitled',
              url: job.applyUrl || ('https://careers.statestreet.com/global/en/job/' + job.jobId),
              location: job.city || job.location || 'Not specified',
              department: job.category || 'General',
              postedDate: job.postedDate ? job.postedDate.split('T')[0] : new Date().toISOString().split('T')[0]
            });
          });
        }
      }
    } catch (e) {}
    return results;
  });

  if (jobs.length > 0) return jobs;

  // Fallback: scrape rendered DOM
  await page.waitForSelector('a[href*="/job/"], [data-ph-at-id="job-link"]', { timeout: 15000 }).catch(function() {});
  return await page.evaluate(function() {
    var results = [];
    var seen = {};
    document.querySelectorAll('a[href*="/job/"]').forEach(function(el) {
      var href = el.getAttribute('href');
      if (!href || seen[href]) return;
      seen[href] = true;
      var title = el.textContent.trim().split('\n')[0].trim();
      if (title && title.length > 3 && title.length < 300) {
        results.push({
          title: title,
          url: href.startsWith('http') ? href : 'https://careers.statestreet.com' + href,
          location: 'Not specified',
          department: 'General',
          postedDate: new Date().toISOString().split('T')[0]
        });
      }
    });
    return results;
  });
}

// --- Raymond James (Taleo) ---

async function scrapeRaymondJames(page, source) {
  await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('table#jobs tr a[href*="jobdetail"], .requisitionListTable tr a, a[href*="jobdetail"]', { timeout: 20000 });

  var allJobs = [];

  for (var p = 0; p < 5; p++) {
    var pageJobs = await page.evaluate(function() {
      var jobs = [];
      var rows = document.querySelectorAll('table#jobs tr, .requisitionListTable tr');
      rows.forEach(function(row) {
        var link = row.querySelector('a[href*="jobdetail"]');
        if (!link) return;
        var title = link.textContent.trim();
        var href = link.getAttribute('href');
        var cells = row.querySelectorAll('td');
        var location = cells.length > 1 ? cells[1].textContent.trim() : 'Not specified';
        if (title && title.length > 3) {
          jobs.push({
            title: title,
            url: href.startsWith('http') ? href : 'https://raymondjames.taleo.net' + href,
            location: location,
            department: 'General',
            postedDate: new Date().toISOString().split('T')[0]
          });
        }
      });
      return jobs;
    });

    allJobs = allJobs.concat(pageJobs);

    var hasNext = await page.evaluate(function() {
      var next = document.querySelector('a#next, .pagerlink[title="Next"], a[title="Next Page"]');
      if (next && !next.classList.contains('disabled') && next.offsetParent !== null) {
        next.click();
        return true;
      }
      return false;
    });
    if (!hasNext) break;
    await new Promise(function(r) { setTimeout(r, 3000); });
    await page.waitForSelector('table#jobs tr a[href*="jobdetail"], .requisitionListTable tr a', { timeout: 10000 }).catch(function() {});
  }

  return allJobs;
}

// --- Mackenzie (iCIMS) ---

async function scrapeMackenzie(page, source) {
  await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(function(r) { setTimeout(r, 5000); });

  // iCIMS loads jobs inside an iframe
  var frame = page;
  var frames = page.frames();
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].url().indexOf('in_iframe=1') !== -1) {
      frame = frames[i];
      break;
    }
  }

  await frame.waitForSelector('.iCIMS_JobsTable', { timeout: 20000 });

  return await frame.evaluate(function() {
    var jobs = [];
    var seen = {};
    document.querySelectorAll('.iCIMS_JobsTable a.iCIMS_Anchor').forEach(function(el) {
      var href = el.getAttribute('href');
      if (!href || seen[href] || href.indexOf('/search') !== -1) return;
      seen[href] = true;

      var h3 = el.querySelector('h3');
      var title = h3 ? h3.textContent.trim() : el.textContent.trim();
      if (!title || title.length < 3) return;

      // Strip in_iframe param from URL
      var cleanUrl = href.replace(/[?&]in_iframe=1/, '');

      // Location is in the .row parent's .header.left span
      var row = el.closest('.row');
      var location = 'Not specified';
      var postedDate = new Date().toISOString().split('T')[0];
      if (row) {
        var locEl = row.querySelector('.header.left span:not(.sr-only)');
        if (locEl) location = locEl.textContent.trim();
        var dateEl = row.querySelector('.header.right span[title]');
        if (dateEl) {
          var raw = dateEl.getAttribute('title');
          var parts = raw.split(' ')[0].split('/');
          if (parts.length === 3) postedDate = parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
        }
      }

      jobs.push({
        title: title,
        url: cleanUrl.startsWith('http') ? cleanUrl : 'https://careersen-mackenzieinvestments.icims.com' + cleanUrl,
        location: location,
        department: 'General',
        postedDate: postedDate
      });
    });
    return jobs;
  });
}

// --- Richardson Wealth (Dayforce / React) ---

async function scrapeRichardson(page, source) {
  await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('a[href*="/jobs/"], .ant-card, .ant-list-item, [class*="job"]', { timeout: 20000 }).catch(function() {});
  await new Promise(function(r) { setTimeout(r, 3000); });

  return await page.evaluate(function() {
    var jobs = [];
    var seen = {};
    var selectors = ['a[href*="/jobs/"]', '.ant-card a', '.ant-list-item a', '[class*="JobCard"] a'];
    var links = [];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) { links.push(el); });
    });

    links.forEach(function(el) {
      var href = el.getAttribute('href');
      if (!href || seen[href]) return;
      seen[href] = true;
      var card = el.closest('.ant-card, .ant-list-item, [class*="job"], [class*="Job"]') || el;
      var heading = card.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="Title"]');
      var title = heading ? heading.textContent.trim() : el.textContent.trim().split('\n')[0].trim();
      if (title && title.length > 3 && title.length < 300) {
        var locationEl = card.querySelector('[class*="location"], [class*="Location"]');
        jobs.push({
          title: title,
          url: href.startsWith('http') ? href : 'https://jobs.dayforcehcm.com' + href,
          location: locationEl ? locationEl.textContent.trim() : 'Not specified',
          department: 'General',
          postedDate: new Date().toISOString().split('T')[0]
        });
      }
    });
    return jobs;
  });
}

// --- IA Wealth (Custom CMS) ---

async function scrapeIaWealth(page, source) {
  await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('a[href*="/carrieres/job/"], a[href*="/careers/job/"]', { timeout: 20000 });

  // Click "Show more" to load all jobs
  for (var i = 0; i < 20; i++) {
    var clicked = await page.evaluate(function() {
      var buttons = document.querySelectorAll('a, button');
      for (var j = 0; j < buttons.length; j++) {
        var text = buttons[j].textContent.toLowerCase();
        if (text.indexOf('show more') !== -1 || text.indexOf('load more') !== -1 || text.indexOf('voir plus') !== -1) {
          buttons[j].click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) break;
    await new Promise(function(r) { setTimeout(r, 2000); });
  }

  return await page.evaluate(function() {
    var jobs = [];
    var seen = {};
    document.querySelectorAll('a[href*="/carrieres/job/"], a[href*="/careers/job/"]').forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || seen[href]) return;
      seen[href] = true;

      var h3 = link.querySelector('h3');
      var title = h3 ? h3.textContent.trim() : link.textContent.trim().split('\n')[0].trim();
      var location = 'Canada';
      var department = 'General';
      var postedDate = new Date().toISOString().split('T')[0];

      link.querySelectorAll('p').forEach(function(p) {
        var text = p.textContent.trim();
        if (text.indexOf('City:') === 0 || text.indexOf('Ville:') === 0) {
          location = text.split(':').slice(1).join(':').trim();
        } else if (text.indexOf('Job category:') === 0 || text.indexOf('Cat') === 0) {
          department = text.split(':').slice(1).join(':').trim();
        } else if (text.indexOf('Date of posting:') === 0 || text.indexOf('Date de publication') === 0) {
          postedDate = text.split(':').slice(1).join(':').trim();
        }
      });

      if (title && title.length > 3) {
        jobs.push({
          title: title,
          url: href.startsWith('http') ? href : 'https://ia.ca' + href,
          location: location,
          department: department,
          postedDate: postedDate
        });
      }
    });
    return jobs;
  });
}

// ==================== MAIN ====================

async function main() {
  console.log('Starting job scraper...\n');
  var results = { lastUpdated: new Date().toISOString(), sources: [] };

  for (var i = 0; i < JOB_SOURCES.length; i++) {
    var source = JOB_SOURCES[i];
    process.stdout.write(source.name + '... ');
    var jobs = [];
    var error = null;
    try {
      if (source.type === 'workday') jobs = await scrapeWorkday(source);
      else if (source.type === 'html') jobs = await scrapeHtml(source);
      else if (source.type === 'ultipro') jobs = await scrapeUltipro(source);
      else if (source.type === 'xml') jobs = await scrapeIgmXml(source);
      else if (source.type === 'puppeteer') jobs = await scrapePuppeteer(source);
      console.log(jobs.length + ' jobs');
    } catch (err) {
      error = err.message;
      console.log('Error: ' + err.message);
    }
    var entry = { id: source.id, name: source.name, url: source.api || source.url, jobCount: jobs.length, jobs: jobs };
    if (error) entry.error = error;
    results.sources.push(entry);
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  if (browser) {
    await browser.close();
    browser = null;
  }

  fs.writeFileSync('jobs.json', JSON.stringify(results, null, 2));
  var total = 0;
  for (var j = 0; j < results.sources.length; j++) total += results.sources[j].jobCount;
  console.log('\nDone! Saved ' + total + ' jobs to jobs.json');
}

main();
