// Renderer process file for the Video Enhancer Dashboard
const { ipcRenderer } = require('electron');
const path = require('path');

// DOM Elements
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

// State variables
let currentFile = null;
let outputPath = null;
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
  // Drop area event listeners
  dropArea.addEventListener('dragover', handleDragOver);
  dropArea.addEventListener('dragleave', handleDragLeave);
  dropArea.addEventListener('drop', handleDrop);
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Settings event listeners
  document.getElementById('upscaling').addEventListener('change', updateSetting);
  sharpeningSlider.addEventListener('input', updateSliderValue);
  document.getElementById('frameRate').addEventListener('change', updateSetting);
  document.getElementById('outputFormat').addEventListener('change', updateSetting);

  // Toggle buttons for noise reduction
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      enhancementSettings.noiseReduction = btn.dataset.value;
    });
  });

  // Save location button
  saveLocationBtn.addEventListener('click', chooseSaveLocation);

  // Enhance button
  enhanceBtn.addEventListener('click', enhanceVideo);

  // Disable enhance button initially
  enhanceBtn.disabled = true;
  enhanceBtn.style.opacity = 0.5;
  enhanceBtn.style.cursor = 'not-allowed';

  // Hide the enhanced video initially
  enhancedVideo.style.display = 'none';
  document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'none';
}

// File handling functions
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.add('active');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.remove('active');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.remove('active');

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
  if (fileInput.files.length) {
    const file = fileInput.files[0];
    processVideoFile(file);
  }
}

function processVideoFile(file) {
  currentFile = file;
  fileName.textContent = file.name;

  // Create URL for the video preview
  const videoURL = URL.createObjectURL(file);
  originalVideo.src = videoURL;

  // Clear any previous enhanced video
  enhancedVideo.src = '';
  enhancedVideo.style.display = 'none';
  document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'none';

  // Enable enhance button
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
  const value = sharpeningSlider.value;
  sharpeningValue.textContent = value;
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
    selectedLocation.textContent = filePath;
  }
}

function enhanceVideo() {
  if (!currentFile) {
    alert('Please upload a video first.');
    return;
  }

  enhanceBtn.disabled = true;
  enhanceBtn.textContent = 'Processing...';

  // Log the settings for demonstration
  console.log('Enhancement Settings:', enhancementSettings);
  console.log('Output Path:', outputPath || 'Default location');

  // Simulate processing delay
  setTimeout(() => {
    // Show the enhanced video (in a real app, this would be the actual enhanced video)
    const videoURL = URL.createObjectURL(currentFile); // In real app, use the enhanced video
    enhancedVideo.src = videoURL;
    enhancedVideo.style.display = 'block';
    document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'block';

    enhanceBtn.textContent = 'Enhance';
    enhanceBtn.disabled = false;

    alert('Video enhancement complete! (This is a simulation)');
  }, 3000);
}

// Clean up function to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (originalVideo.src) {
    URL.revokeObjectURL(originalVideo.src);
  }
  if (enhancedVideo.src) {
    URL.revokeObjectURL(enhancedVideo.src);
  }



  // Add to state variables (at the top with other state variables)
  let history = [];

  // Add to initApp() function (inside the function, with other event listeners)
  document.getElementById('historyBtn').addEventListener('click', openHistoryModal);

  // Add these new functions at the bottom of the file (before the window.addEventListener('beforeunload')):

  function openHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.style.display = 'block';
    updateHistoryUI();

    // Add click handler for close button
    document.querySelector('.close-modal').onclick = function () {
      modal.style.display = 'none';
    };

    // Close when clicking outside modal
    window.onclick = function (event) {
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

    history.unshift(historyItem); // Add to beginning of array
    updateHistoryUI();

    // In a real app, you would save this to a file or database
    console.log('Saved to history:', historyItem);
  }

  function updateHistoryUI() {
    const historyList = document.getElementById('historyList');
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
      // In a real app, you would open the enhanced video
      alert(`Would open enhanced video: ${item.enhancedPath}`);
    } else if (action === 'delete') {
      history = history.filter(i => i.id !== id);
      updateHistoryUI();
    }
  }

  // Modify your existing enhanceVideo() function to include saving to history:
  function enhanceVideo() {
    if (!currentFile) {
      alert('Please upload a video first.');
      return;
    }

    enhanceBtn.disabled = true;
    enhanceBtn.textContent = 'Processing...';

    // Log the settings for demonstration
    console.log('Enhancement Settings:', enhancementSettings);
    console.log('Output Path:', outputPath || 'Default location');

    // Simulate processing delay
    setTimeout(() => {
      // Show the enhanced video (in a real app, this would be the actual enhanced video)
      const videoURL = URL.createObjectURL(currentFile); // In real app, use the enhanced video
      enhancedVideo.src = videoURL;
      enhancedVideo.style.display = 'block';
      document.querySelector('.preview-box:nth-child(2) .preview-label').style.display = 'block';

      // Save to history
      saveToHistory(currentFile, { path: outputPath || 'default_location' }, enhancementSettings);

      enhanceBtn.textContent = 'Enhance';
      enhanceBtn.disabled = false;

      alert('Video enhancement complete! (This is a simulation)');
    }, 3000);
  }
});