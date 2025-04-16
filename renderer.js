// Renderer process file for the Video Enhancer Dashboard
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// State variables
let currentFile = null;
let outputPath = null;
let history = [];
let enhancementSettings = {
  upscaling: '2x',
  sharpening: 50,
  noiseReduction: 'low',
  frameRate: '30',
  outputFormat: 'MP4'
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  // Get DOM elements
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const originalVideo = document.getElementById('originalVideo');
  const enhancedVideo = document.getElementById('enhancedVideo');
  const sharpeningSlider = document.getElementById('sharpening');
  const sharpeningValue = document.getElementById('sharpeningValue');
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const saveLocationBtn = document.getElementById('saveLocationBtn');
  const selectedLocation = document.getElementById('selectedLocation');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const historyBtn = document.getElementById('historyBtn');

  // Verify all required elements exist
  if (!dropArea || !fileInput || !enhanceBtn || !originalVideo || !enhancedVideo) {
    console.error('Critical DOM elements missing');
    return;
  }

  // Drop area event listeners
  dropArea.addEventListener('dragover', handleDragOver);
  dropArea.addEventListener('dragleave', handleDragLeave);
  dropArea.addEventListener('drop', handleDrop);
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Settings event listeners
  document.getElementById('upscaling')?.addEventListener('change', updateSetting);
  sharpeningSlider?.addEventListener('input', updateSliderValue);
  document.getElementById('frameRate')?.addEventListener('change', updateSetting);
  document.getElementById('outputFormat')?.addEventListener('change', updateSetting);

  // Toggle buttons for noise reduction
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      enhancementSettings.noiseReduction = btn.dataset.value;
    });
  });

  // Save location button
  saveLocationBtn?.addEventListener('click', chooseSaveLocation);

  // Enhance button
  enhanceBtn.addEventListener('click', enhanceVideo);

  // History button
  historyBtn?.addEventListener('click', openHistoryModal);

  // Initial UI state
  enhanceBtn.disabled = true;
  enhanceBtn.style.opacity = 0.5;
  enhanceBtn.style.cursor = 'not-allowed';
  enhancedVideo.style.display = 'none';
  document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'none';
}

// File handling functions
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('active');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('active');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('active');

  if (e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('video/')) {
      processVideoFile(file);
    } else {
      alert('Please upload a video file.');
    }
  }
}

function handleFileSelect(e) {
  if (e.target.files.length) {
    const file = e.target.files[0];
    processVideoFile(file);
  }
}

function processVideoFile(file) {
  currentFile = file;
  document.getElementById('fileName').textContent = file.name;

  // Create URL for the video preview
  const videoURL = URL.createObjectURL(file);
  document.getElementById('originalVideo').src = videoURL;

  // Clear any previous enhanced video
  const enhancedVideo = document.getElementById('enhancedVideo');
  enhancedVideo.src = '';
  enhancedVideo.style.display = 'none';
  document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'none';

  // Enable enhance button
  const enhanceBtn = document.getElementById('enhanceBtn');
  enhanceBtn.disabled = false;
  enhanceBtn.style.opacity = 1;
  enhanceBtn.style.cursor = 'pointer';
}

// Settings functions
function updateSetting(e) {
  const setting = e.target.id;
  const value = e.target.value;
  enhancementSettings[setting] = value;
}

function updateSliderValue() {
  const value = document.getElementById('sharpening').value;
  document.getElementById('sharpeningValue').textContent = value;
  enhancementSettings.sharpening = value;
}

async function chooseSaveLocation() {
  const format = document.getElementById('outputFormat').value;
  let defaultName = 'enhanced_video.' + format.toLowerCase();

  if (currentFile) {
    const basename = path.basename(currentFile.name, path.extname(currentFile.name));
    defaultName = `${basename}_enhanced.${format.toLowerCase()}`;
  }

  const filePath = await ipcRenderer.invoke('save-file-dialog', defaultName, format);
  if (filePath) {
    outputPath = filePath;
    document.getElementById('selectedLocation').textContent = filePath;
  }
}

// Video enhancement function
async function enhanceVideo() {
  if (!currentFile) {
    alert('Please upload a video first.');
    return;
  }

  const enhanceBtn = document.getElementById('enhanceBtn');
  enhanceBtn.disabled = true;
  enhanceBtn.textContent = 'Processing...';

  // Create progress elements
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  progressContainer.innerHTML = `
    <div class="progress-bar" id="progressBar"></div>
    <div class="progress-text" id="progressText">Starting...</div>
  `;
  document.querySelector('.settings-panel').appendChild(progressContainer);

  try {
    // Get the file path
    const inputPath = await ipcRenderer.invoke('get-file-path', currentFile.name);
    if (!inputPath) throw new Error('Could not resolve file path');

    const outputDir = outputPath ? path.dirname(outputPath) : path.join(__dirname, '..', 'Real-ESRGAN-master', 'results');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    updateProgress(10, 'Preparing enhancement...');

    // Get model based on upscaling setting
    const model = enhancementSettings.upscaling === '2x' ? 'RealESRGAN_x2plus' : 'RealESRGAN_x4plus';

    // Execute the enhancement
    const projectPath = path.join(__dirname, '..', 'Real-ESRGAN-master');
    updateProgress(30, 'Running enhancement...');
    
    const result = await ipcRenderer.invoke('execute-enhancement', {
      projectPath,
      inputPath,
      outputPath: outputDir,
      model
    });

    if (!result.success) {
      console.error('Enhancement failed:', result.error, result.stack);
      throw new Error(result.error);
    }

    updateProgress(90, 'Loading enhanced video...');

    // Use the exact output file path returned from the backend
    const fullOutputPath = result.outputFile;
    if (!fs.existsSync(fullOutputPath)) {
      throw new Error(`Output file not found at: ${fullOutputPath}`);
    }

    // Load the enhanced video
    const enhancedVideo = document.getElementById('enhancedVideo');
    enhancedVideo.src = fullOutputPath;
    enhancedVideo.style.display = 'block';
    document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'block';

    // Save to history
    saveToHistory(currentFile, { path: fullOutputPath }, enhancementSettings);

    updateProgress(100, 'Enhancement complete!');
    setTimeout(() => {
      alert('Video enhancement complete!');
    }, 500);
  } catch (error) {
    console.error('Full enhancement error:', error);
    alert(`Enhancement failed: ${error.message}`);
  } finally {
    enhanceBtn.textContent = 'Enhance';
    enhanceBtn.disabled = false;
    setTimeout(() => {
      const container = document.querySelector('.progress-container');
      if (container) container.remove();
    }, 2000);
  }
}

// Helper function to update progress
function updateProgress(percent, message) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressText) progressText.textContent = message;
}

// History functions
function openHistoryModal() {
  const modal = document.getElementById('historyModal');
  modal.style.display = 'block';
  updateHistoryUI();

  // Add click handler for close button
  document.querySelector('.close-modal').onclick = function() {
    modal.style.display = 'none';
  };

  // Close when clicking outside modal
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  };
}

function saveToHistory(originalFile, enhancedFile, settings) {
  const historyItem = {
    id: Date.now(),
    originalName: originalFile.name,
    enhancedPath: enhancedFile.path || 'Default location',
    date: new Date().toLocaleString(),
    settings: settings
  };

  history.unshift(historyItem);
  updateHistoryUI();
  console.log('Saved to history:', historyItem);
}

function updateHistoryUI() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No enhancement history yet</div>';
    return;
  }

  history.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <div class="history-info">
        <div class="history-name" title="${item.originalName}">${item.originalName}</div>
        <div class="history-details">Enhanced on ${item.date}</div>
        <div class="history-settings">
          Upscaling: ${item.settings.upscaling} | 
          Sharpening: ${item.settings.sharpening} | 
          Noise Reduction: ${item.settings.noiseReduction}
        </div>
      </div>
      <div class="history-actions">
        <button class="history-action-btn" data-id="${item.id}" data-action="view">View</button>
        <button class="history-action-btn" data-id="${item.id}" data-action="delete">Delete</button>
      </div>
    `;
    historyList.appendChild(historyItem);
  });

  // Add event listeners to action buttons
  document.querySelectorAll('.history-action-btn').forEach(btn => {
    btn.addEventListener('click', handleHistoryAction);
  });
}

function handleHistoryAction(e) {
  const id = parseInt(e.target.dataset.id);
  const action = e.target.dataset.action;
  const item = history.find(i => i.id === id);

  if (!item) return;

  if (action === 'view') {
    alert(`Would open enhanced video: ${item.enhancedPath}`);
  } else if (action === 'delete') {
    history = history.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

// Clean up function to prevent memory leaks
window.addEventListener('beforeunload', () => {
  const originalVideo = document.getElementById('originalVideo');
  const enhancedVideo = document.getElementById('enhancedVideo');
  
  if (originalVideo?.src) {
    URL.revokeObjectURL(originalVideo.src);
  }
  if (enhancedVideo?.src) {
    URL.revokeObjectURL(enhancedVideo.src);
  }
});