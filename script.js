const paperInput = document.getElementById('paperInput');
const dropZone = document.getElementById('dropZone');
const browseButton = document.getElementById('browseButton');
const fileSelected = document.getElementById('fileSelected');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const clearFile = document.getElementById('clearFile');
const uploadForm = document.getElementById('uploadForm');
const formMessage = document.getElementById('formMessage');
const processing = document.getElementById('processing');
const processingText = document.getElementById('processingText');
const processingPercent = document.getElementById('processingPercent');
const progressBar = document.getElementById('progressBar');
const processSteps = document.querySelectorAll('.process-steps span');
const resultEmpty = document.getElementById('resultEmpty');
const resultWrap = document.getElementById('resultWrap');
const resultFileName = document.getElementById('resultFileName');
const summaryLead = document.getElementById('summaryLead');
const questionTitle = document.getElementById('questionTitle');
const questionBody = document.getElementById('questionBody');
const approachTitle = document.getElementById('approachTitle');
const approachBody = document.getElementById('approachBody');
const conclusionTitle = document.getElementById('conclusionTitle');
const conclusionBody = document.getElementById('conclusionBody');
const takeawaysList = document.getElementById('takeawaysList');
const generateButton = document.querySelector('.generate-button');
const downloadBtn = document.getElementById('downloadBtn');
const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

let selectedFile = null;

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showFile(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    formMessage.textContent = 'Please choose a PDF research paper.';
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    formMessage.textContent = 'This file is over the 25 MB limit. Please choose a smaller PDF.';
    return;
  }

  selectedFile = file;
  formMessage.textContent = '';
  fileName.textContent = file.name;
  fileSize.textContent = `${formatFileSize(file.size)} · PDF document`;
  fileSelected.classList.add('show');
  dropZone.style.display = 'none';
}

browseButton.addEventListener('click', () => paperInput.click());
dropZone.addEventListener('click', () => paperInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    paperInput.click();
  }
});
paperInput.addEventListener('change', () => showFile(paperInput.files[0]));

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', (event) => showFile(event.dataTransfer.files[0]));

clearFile.addEventListener('click', () => {
  selectedFile = null;
  paperInput.value = '';
  fileSelected.classList.remove('show');
  dropZone.style.display = '';
  formMessage.textContent = '';
});

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// The backend route that reads the PDF and returns a real, paper-specific summary.
// Change this if your Flask route lives at a different path or port.
const SUMMARIZE_ENDPOINT = '/summarize';

// Holds the most recent summary returned by the backend, so the download
// button can build a PDF from real content instead of fixed text.
let currentSummary = null;

function updateProcessing(percent, message, activeIndex) {
  progressBar.style.width = `${percent}%`;
  processingPercent.textContent = `${percent}%`;
  processingText.textContent = message;
  processSteps.forEach((step, index) => step.classList.toggle('active', index <= activeIndex));
}

// Fills the visible result card with whatever the backend actually returned.
function renderSummary(summary) {
  currentSummary = summary;

  summaryLead.textContent = summary.in_one_breath || '';

  questionTitle.textContent = summary.question?.title || 'The main question';
  questionBody.textContent = summary.question?.body || '';

  approachTitle.textContent = summary.approach?.title || 'The method';
  approachBody.textContent = summary.approach?.body || '';

  conclusionTitle.textContent = summary.conclusion?.title || 'The conclusion';
  conclusionBody.textContent = summary.conclusion?.body || '';

  takeawaysList.innerHTML = '';
  (summary.takeaways || []).forEach((point) => {
    const item = document.createElement('li');
    item.textContent = point;
    takeawaysList.appendChild(item);
  });
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile) {
    formMessage.textContent = 'Choose a PDF first, then we’ll create your summary.';
    dropZone.focus();
    return;
  }

  formMessage.textContent = '';
  generateButton.disabled = true;
  generateButton.innerHTML = 'Creating your summary <span>…</span>';
  processing.setAttribute('aria-hidden', 'false');
  processing.classList.add('show');

  // This drives the progress bar's look and feel only. The real work — reading
  // the PDF and generating the summary — happens in the fetch() call below,
  // on the Python backend. We cap this at 90% and only jump to 100% once the
  // actual response comes back, so the bar never lies about being "done".
  updateProcessing(12, 'Preparing your document…', 0);
  const progressTicker = (async () => {
    await pause(600);
    updateProcessing(35, 'Extracting text from the paper…', 0);
    await pause(700);
    updateProcessing(60, 'Finding the central ideas…', 1);
    await pause(700);
    updateProcessing(85, 'Writing your clear summary…', 2);
  })();

  try {
    const formData = new FormData();
    formData.append('paper', selectedFile);

    const response = await fetch(SUMMARIZE_ENDPOINT, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const summary = await response.json();
    await progressTicker;
    updateProcessing(100, 'Your summary is ready.', 2);
    await pause(300);

    renderSummary(summary);
    resultFileName.textContent = selectedFile.name;
    resultEmpty.hidden = true;
    resultWrap.hidden = false;
    resultWrap.classList.add('reveal-on-scroll');
    requestAnimationFrame(() => resultWrap.classList.add('is-visible'));
    resultWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    await progressTicker;
    formMessage.textContent = 'Something went wrong while summarizing this paper. Please try again.';
    console.error('Summarize request failed:', error);
  } finally {
    generateButton.disabled = false;
    generateButton.innerHTML = 'Generate my summary <span>→</span>';
    setTimeout(() => {
      processing.classList.remove('show');
      processing.setAttribute('aria-hidden', 'true');
    }, 750);
  }
});

// Give each section its own entrance as it arrives in the reader's viewport.
const revealGroups = [
  ['.section-heading', 0],
  ['.step-card', 90],
  ['.upload-intro', 0],
  ['.upload-card', 80],
  ['.process-card', 150],
  ['.result-empty', 0],
  ['.footer-main', 0],
  ['.footer-bottom', 100]
];

const revealItems = [];
revealGroups.forEach(([selector, stagger]) => {
  document.querySelectorAll(selector).forEach((element, index) => {
    // Do not override the hero note's own first-load animation.
    element.classList.add('reveal-on-scroll');
    element.style.setProperty('--reveal-delay', `${index * stagger}ms`);
    revealItems.push(element);
  });
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -45px' });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

// A small, dependency-free PDF creator. It makes the summary available as a real PDF
// without needing a server or third-party library.
function ascii(value) {
  const replacements = {
    '’': "'", '‘': "'", '“': '"', '”': '"', '—': '-', '–': '-', '…': '...', '•': '-', '·': '-'
  };
  return String(value)
    .replace(/[’‘“”—–…•·]/g, (character) => replacements[character])
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxCharacters = 87) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (`${line} ${word}`.trim().length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines;
}

function line(text, style = 'body') {
  const settings = {
    title: { size: 21, gap: 31 },
    subtitle: { size: 10, gap: 22 },
    section: { size: 12, gap: 20 },
    body: { size: 10.5, gap: 15 },
    footer: { size: 8, gap: 12 }
  }[style];
  return { text: ascii(text), ...settings };
}

function createSummaryPDF(title, summary) {
  const takeaways = (summary?.takeaways?.length ? summary.takeaways : ['No takeaways were returned for this paper.']);

  const contents = [
    line('PAPERLY', 'subtitle'),
    line('Research Paper Summary', 'title'),
    line(`Source: ${title}`, 'subtitle'),
    line(''),
    line('IN ONE BREATH', 'section'),
    ...wrapText(summary?.in_one_breath || 'No summary was returned for this paper.').map((item) => line(item)),
    line(''),
    line('THE QUESTION', 'section'),
    ...wrapText(summary?.question?.body || '').map((item) => line(item)),
    line(''),
    line('THE APPROACH', 'section'),
    ...wrapText(summary?.approach?.body || '').map((item) => line(item)),
    line(''),
    line('THE CONCLUSION', 'section'),
    ...wrapText(summary?.conclusion?.body || '').map((item) => line(item)),
    line(''),
    line('KEY TAKEAWAYS', 'section'),
    ...takeaways.map((point) => line(`- ${point}`)),
    line(''),
    line('Generated by Paperly. Read deeply. Start anywhere.', 'footer')
  ];

  const pages = [];
  let pageLines = [];
  let y = 792;
  contents.forEach((item) => {
    if (y - item.gap < 48) {
      pages.push(pageLines);
      pageLines = [];
      y = 792;
    }
    pageLines.push({ ...item, y });
    y -= item.gap;
  });
  if (pageLines.length) pages.push(pageLines);

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  pages.forEach((page, index) => {
    const pageNumber = 4 + index * 2;
    const streamNumber = pageNumber + 1;
    const commands = ['BT'];
    page.forEach((item) => {
      if (item.text) {
        commands.push(`/F1 ${item.size} Tf`);
        commands.push(`1 0 0 1 50 ${item.y} Tm`);
        commands.push(`(${item.text}) Tj`);
      }
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 595 842] /Contents ${streamNumber} 0 R >>`;
    objects[streamNumber] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n%Paperly\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefPosition = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

downloadBtn.addEventListener('click', () => {
  if (!currentSummary) {
    formMessage.textContent = 'Generate a summary first, then you can download it.';
    return;
  }
  const sourceName = selectedFile ? selectedFile.name : 'paperly-research-paper';
  const safeName = sourceName.replace(/\.pdf$/i, '').replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').toLowerCase();
  const blob = createSummaryPDF(sourceName, currentSummary);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}-summary.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  navLinks.classList.toggle('open', !isOpen);
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    navLinks.classList.remove('open');
  });
});