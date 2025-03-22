// DOM Elements
const createButton = document.getElementById('create-button');
const createModal = document.getElementById('create-modal');
const closeModalButton = document.getElementById('close-modal');
const startCameraButton = document.getElementById('start-camera');
const recordVideoButton = document.getElementById('record-video');
const stopRecordingButton = document.getElementById('stop-recording');
const uploadVideoButton = document.getElementById('upload-video');
const videoUploadInput = document.getElementById('video-upload');
const postVideoButton = document.getElementById('post-button');
const cameraFeed = document.getElementById('camera-feed');
const videoPreview = document.getElementById('video-preview');
const videoCaptionInput = document.getElementById('video-caption');
const videoTagsInput = document.getElementById('video-tags');
const contentFeed = document.querySelector('.content-feed');
const emptyState = document.getElementById('empty-state');

// Global variables
let mediaRecorder;
let recordedBlobs = [];
let stream;
let recordedVideoURL = null;
let currentRecordedBlob = null;
let uploadedFile = null;

// Maximum file size (5MB for localStorage)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load videos from local storage
    loadVideos();
    
    // Handle navigation clicks
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(navItem => navItem.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Handle search bar functionality
    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            alert(`Searching for: ${searchBar.value}`);
            searchBar.value = '';
        }
    });
    
    const searchButton = document.querySelector('.search-button');
    searchButton.addEventListener('click', () => {
        alert(`Searching for: ${searchBar.value}`);
        searchBar.value = '';
    });
    
    // Video creation modal
    createButton.addEventListener('click', openCreateModal);
    closeModalButton.addEventListener('click', closeCreateModal);
    
    // Camera and video recording
    startCameraButton.addEventListener('click', startCamera);
    recordVideoButton.addEventListener('click', startRecording);
    stopRecordingButton.addEventListener('click', stopRecording);
    uploadVideoButton.addEventListener('click', () => videoUploadInput.click());
    videoUploadInput.addEventListener('change', handleVideoUpload);
    
    // Post video button
    postVideoButton && postVideoButton.addEventListener('click', postVideo);
});

// Function to load videos from local storage
function loadVideos() {
    const savedVideos = JSON.parse(localStorage.getItem('googleGigglesVideos')) || [];
    
    if (savedVideos.length > 0) {
        emptyState.style.display = 'none';
        savedVideos.forEach(video => {
            createVideoElement(video);
        });
    } else {
        emptyState.style.display = 'flex';
    }
}

// Function to create a video element from stored video data
function createVideoElement(videoData) {
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item';
    
    videoItem.innerHTML = `
        <div class="video-placeholder">
            <video class="video-element" src="${videoData.videoUrl}" controls></video>
            <span class="material-icons play-icon">play_circle</span>
        </div>
        <div class="video-info">
            <div class="user-info">
                <div class="avatar"></div>
                <span class="username">Me</span>
            </div>
            <p class="video-caption">${videoData.caption || ''} ${videoData.tags || ''}</p>
            <div class="video-actions">
                <button><span class="material-icons">favorite_border</span> 0</button>
                <button><span class="material-icons">chat_bubble_outline</span> 0</button>
                <button><span class="material-icons">share</span></button>
            </div>
        </div>
    `;
    
    // Add click event to play/pause video
    const videoElement = videoItem.querySelector('.video-element');
    const playIcon = videoItem.querySelector('.play-icon');
    const videoPlaceholder = videoItem.querySelector('.video-placeholder');
    
    videoPlaceholder.addEventListener('click', () => {
        if (videoElement.paused) {
            // Try to play and handle any errors
            const playPromise = videoElement.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Playback started successfully
                    playIcon.style.display = 'none';
                }).catch(error => {
                    console.error('Error playing video:', error);
                    alert('Error playing video. Please try again.');
                });
            }
        } else {
            videoElement.pause();
            playIcon.style.display = 'block';
        }
    });
    
    // Handle video loading errors
    videoElement.addEventListener('error', (e) => {
        console.error('Video loading error:', e);
        videoPlaceholder.innerHTML = `
            <div style="padding: 20px; text-align: center; color: white;">
                <span class="material-icons" style="font-size: 48px;">error</span>
                <p>Error loading video</p>
            </div>
        `;
    });
    
    // Add to the beginning of the feed (newest first)
    contentFeed.insertBefore(videoItem, contentFeed.firstChild);
}

// Open create modal
function openCreateModal() {
    createModal.style.display = 'block';
    resetVideoCreation();
}

// Close create modal
function closeCreateModal() {
    createModal.style.display = 'none';
    stopCameraStream();
    resetVideoCreation();
}

// Reset video creation state
function resetVideoCreation() {
    stopCameraStream();
    recordedBlobs = [];
    recordedVideoURL = null;
    currentRecordedBlob = null;
    uploadedFile = null;
    
    // Try to safely access and disable buttons
    if (postVideoButton) postVideoButton.disabled = true;
    if (recordVideoButton) recordVideoButton.disabled = true;
    if (stopRecordingButton) stopRecordingButton.disabled = true;
    if (videoCaptionInput) videoCaptionInput.value = '';
    if (videoTagsInput) videoTagsInput.value = '';
    
    // Reset video preview
    if (videoPreview) {
        const existingVideo = videoPreview.querySelector('.recorded-video');
        if (existingVideo) {
            videoPreview.removeChild(existingVideo);
        }
        if (cameraFeed) cameraFeed.style.display = 'none';
        const placeholder = videoPreview.querySelector('.camera-placeholder');
        if (placeholder) placeholder.style.display = 'block';
    }
}

// Start camera
async function startCamera() {
    try {
        stopCameraStream(); // Stop any existing stream
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "user",
                width: { ideal: 320 },
                height: { ideal: 240 }
            }, 
            audio: true 
        });
        
        cameraFeed.srcObject = stream;
        cameraFeed.style.display = 'block';
        videoPreview.querySelector('.camera-placeholder').style.display = 'none';
        
        recordVideoButton.disabled = false;
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access camera. Please check permissions.');
    }
}

// Stop camera stream
function stopCameraStream() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (cameraFeed && cameraFeed.srcObject) {
        cameraFeed.srcObject = null;
    }
}

// Start recording
function startRecording() {
    recordedBlobs = [];
    
    try {
        // Try different MIME types for better compatibility
        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ];
        
        let mimeType = '';
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }
        
        if (!mimeType) {
            throw new Error('No supported MIME type found for MediaRecorder');
        }
        
        // Create recorder with compatible MIME type
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedBlobs.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            try {
                currentRecordedBlob = new Blob(recordedBlobs, { type: mimeType });
                
                // Check file size
                if (currentRecordedBlob.size > MAX_FILE_SIZE) {
                    throw new Error(`Video file is too large (${Math.round(currentRecordedBlob.size / 1024 / 1024)}MB). Please record a shorter video.`);
                }
                
                recordedVideoURL = URL.createObjectURL(currentRecordedBlob);
                
                // Display recorded video
                const recordedVideo = document.createElement('video');
                recordedVideo.className = 'recorded-video';
                recordedVideo.src = recordedVideoURL;
                recordedVideo.controls = true;
                recordedVideo.style.display = 'block';
                
                // Clean up existing video preview
                cameraFeed.style.display = 'none';
                
                // Add recorded video
                const existingRecordedVideo = videoPreview.querySelector('.recorded-video');
                if (existingRecordedVideo) {
                    videoPreview.removeChild(existingRecordedVideo);
                }
                
                videoPreview.querySelector('.camera-placeholder').style.display = 'none';
                videoPreview.appendChild(recordedVideo);
                
                if (postVideoButton) postVideoButton.disabled = false;
                
            } catch (error) {
                console.error('Error processing recorded video:', error);
                alert(`Recording error: ${error.message || 'Failed to process video'}`);
            }
        };
        
        // Start recording
        mediaRecorder.start(100);
        if (recordVideoButton) recordVideoButton.disabled = true;
        if (stopRecordingButton) stopRecordingButton.disabled = false;
        
    } catch (error) {
        console.error('Error starting recording:', error);
        alert(`Could not start recording: ${error.message}`);
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopCameraStream();
        if (stopRecordingButton) stopRecordingButton.disabled = true;
    }
}

// Handle video upload
function handleVideoUpload(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    try {
        // Check if it's a video file
        if (!file.type.startsWith('video/')) {
            throw new Error('Selected file is not a video. Please select a video file.');
        }
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Video file is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 5MB.`);
        }
        
        uploadedFile = file;
        recordedVideoURL = URL.createObjectURL(file);
        
        // Display uploaded video
        const uploadedVideo = document.createElement('video');
        uploadedVideo.className = 'recorded-video';
        uploadedVideo.src = recordedVideoURL;
        uploadedVideo.controls = true;
        uploadedVideo.style.display = 'block';
        
        // Clean up existing video preview
        if (cameraFeed) cameraFeed.style.display = 'none';
        
        // Add uploaded video
        const existingVideo = videoPreview.querySelector('.recorded-video');
        if (existingVideo) {
            videoPreview.removeChild(existingVideo);
        }
        
        const placeholder = videoPreview.querySelector('.camera-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        videoPreview.appendChild(uploadedVideo);
        
        // Test if video is playable
        uploadedVideo.addEventListener('loadeddata', () => {
            if (postVideoButton) postVideoButton.disabled = false;
        });
        
        uploadedVideo.addEventListener('error', (e) => {
            console.error('Video preview error:', e);
            alert('This video format is not supported. Please try a different video.');
            resetVideoCreation();
        });
        
    } catch (error) {
        console.error('Error handling video upload:', error);
        alert(error.message || 'Failed to upload video. Please try again.');
        // Reset the input field
        event.target.value = '';
    }
}

// Store video in a way that persists across page reloads
async function storeVideo() {
    try {
        // For this simple demo, we'll use URLs
        // In a production app, you'd use a server or IndexedDB for larger files
        
        // Create a simple video entry that can be stored in localStorage
        if (uploadedFile) {
            // For uploaded files, create a blob URL
            return URL.createObjectURL(uploadedFile);
        } else if (currentRecordedBlob) {
            // For recorded video, create a blob URL
            return URL.createObjectURL(currentRecordedBlob);
        }
        
        throw new Error('No video available to store');
    } catch (error) {
        console.error('Error storing video:', error);
        throw error;
    }
}

// Post video to feed
async function postVideo() {
    if (!recordedVideoURL && !uploadedFile && !currentRecordedBlob) {
        alert('Please record or upload a video first');
        return;
    }
    
    try {
        // Store the video
        const storedVideoUrl = await storeVideo();
        
        if (!storedVideoUrl) {
            throw new Error('Failed to store video');
        }
        
        const caption = videoCaptionInput ? videoCaptionInput.value.trim() : '';
        const tags = videoTagsInput ? videoTagsInput.value.trim() : '';
        
        // Create video data object - only store metadata in localStorage
        const videoData = {
            videoUrl: storedVideoUrl,
            caption: caption,
            tags: tags,
            timestamp: new Date().toISOString()
        };
        
        // Save to local storage
        const savedVideos = JSON.parse(localStorage.getItem('googleGigglesVideos')) || [];
        savedVideos.unshift(videoData);
        
        // Check if localStorage can handle this
        try {
            localStorage.setItem('googleGigglesVideos', JSON.stringify(savedVideos));
        } catch (e) {
            // If we hit storage limit, keep only the newest video
            console.warn('localStorage limit reached, keeping only current video');
            localStorage.setItem('googleGigglesVideos', JSON.stringify([videoData]));
        }
        
        // Create video element in feed
        createVideoElement(videoData);
        
        // Hide empty state if this is the first video
        if (emptyState && emptyState.style.display === 'flex') {
            emptyState.style.display = 'none';
        }
        
        // Close modal
        closeCreateModal();
        
    } catch (error) {
        console.error('Error posting video:', error);
        alert(`Failed to post video: ${error.message || 'Unknown error'}`);
    }
} 