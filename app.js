// Main Application JavaScript
(function() {
    'use strict';
    
    // DOM Elements
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const cards = document.querySelectorAll('.lesson-card');
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    const languageOptions = document.querySelectorAll('.language-option');
    const iframeContainer = document.getElementById('iframe-container');
    const iframe = document.getElementById('lesson-iframe');
    const menu = document.getElementById('menu');
    const installPrompt = document.getElementById('installPrompt');
    const btnInstall = document.getElementById('btnInstall');
    const btnDismiss = document.getElementById('btnDismiss');
    const updateNotification = document.getElementById('updateNotification');
    const btnUpdate = document.getElementById('btnUpdate');
    
    // State
    let currentLanguage = localStorage.getItem('selectedLanguage') || 'mg';
    let swRegistration = null;
    let deferredPrompt = null;
    
    // Initialize App
    function init() {
        updateLanguageUI(currentLanguage);
        updateAllTranslations(currentLanguage);
        setupEventListeners();
        registerServiceWorker();
        setupInstallPrompt();
    }
    
    // Update all text content based on selected language
    function updateAllTranslations(lang) {
        const t = translations[lang];
        
        // Header
        document.querySelector('.app-title').textContent = t.appTitle;
        document.querySelector('.app-subtitle').textContent = t.appSubtitle;
        
        // Welcome section
        document.querySelector('.welcome-title').textContent = t.welcomeTitle;
        document.querySelector('.welcome-description').textContent = t.welcomeDescription;
        
        // Lesson cards
        const lessonTitles = document.querySelectorAll('.lesson-title');
        lessonTitles[0].textContent = t.lessons.adult;
        lessonTitles[1].textContent = t.lessons.youth;
        lessonTitles[2].textContent = t.lessons.young;
        
        // Status text
        document.querySelectorAll('.lesson-meta span:last-child').forEach(span => {
            span.textContent = t.ready;
        });
        
        // Loading overlay
        document.querySelector('.loading-overlay h2').textContent = t.loading;
        loadingText.textContent = t.loadingLesson;
        
        // Install prompt
        document.querySelector('.install-prompt h3').textContent = t.installTitle;
        document.querySelector('.install-prompt p').textContent = t.installDescription;
        btnInstall.textContent = t.installButton;
        btnDismiss.textContent = t.dismissButton;
        
        // Update notification
        document.querySelector('.update-notification h3').textContent = t.updateTitle;
        document.querySelector('.update-notification p').textContent = t.updateDescription;
        btnUpdate.textContent = t.updateButton;
        
        // Footer
        document.querySelector('.footer p').textContent = t.footer;
        
        // Language dropdown
        const langOptions = document.querySelectorAll('.lang-name');
        langOptions[0].textContent = t.languageMalagasy;
        langOptions[1].textContent = t.languageEnglish;
    }
    
    // Setup Event Listeners
    function setupEventListeners() {
        // Language selector
        languageBtn.addEventListener('click', handleLanguageButtonClick);
        document.addEventListener('click', handleDocumentClick);
        languageOptions.forEach(option => {
            option.addEventListener('click', handleLanguageOptionClick);
        });
        
        // Lesson cards
        cards.forEach(card => {
            card.addEventListener('click', handleLessonCardClick);
        });
        
        // Browser navigation
        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        if ('onpagehide' in window) {
            window.addEventListener('pagehide', handlePageHide);
        }
        
        // Install buttons
        btnInstall.addEventListener('click', handleInstallClick);
        btnDismiss.addEventListener('click', handleDismissClick);
        
        // Update button
        btnUpdate.addEventListener('click', handleUpdateClick);
    }
    
    // Language Button Click Handler
    function handleLanguageButtonClick(e) {
        e.stopPropagation();
        languageDropdown.classList.toggle('show');
    }
    
    // Document Click Handler (close dropdown)
    function handleDocumentClick(e) {
        if (!languageDropdown.contains(e.target) && e.target !== languageBtn) {
            languageDropdown.classList.remove('show');
        }
    }
    
    // Language Option Click Handler
    function handleLanguageOptionClick(e) {
        e.stopPropagation();
        const lang = this.dataset.lang;
        currentLanguage = lang;
        localStorage.setItem('selectedLanguage', lang);
        updateLanguageUI(lang);
        updateAllTranslations(lang);
        languageDropdown.classList.remove('show');
    }
    
    // Update Language UI
    function updateLanguageUI(lang) {
        languageOptions.forEach(option => {
            if (option.dataset.lang === lang) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        // Update HTML lang attribute
        document.documentElement.lang = lang;
    }
    
    // Lesson Card Click Handler
    async function handleLessonCardClick(e) {
        e.preventDefault();
        
        const url = currentLanguage === 'mg' ? this.dataset.urlMg : this.dataset.urlEn;
        const lessonKey = 'lesson_visited_' + this.dataset.lesson;
        
        loadingOverlay.classList.add('active');
        loadingText.textContent = translations[currentLanguage].loadingLesson;
        
        iframe.src = url;
        
        localStorage.setItem(lessonKey, 'true');
        localStorage.setItem('last_visited_lesson', url);
        
        setTimeout(() => {
            loadingOverlay.classList.remove('active');
            iframeContainer.classList.add('active');
            menu.style.display = 'none';
            history.pushState({page: 'lesson', url: url}, '', '#lesson');
        }, 1500);
    }
    
    // Pop State Handler
    function handlePopState(event) {
        if (iframeContainer.classList.contains('active')) {
            iframeContainer.classList.remove('active');
            menu.style.display = 'block';
            iframe.src = '';
        }
    }
    
    // Before Unload Handler
    function handleBeforeUnload() {
        if (iframe.src) {
            const currentCard = Array.from(cards).find(card => 
                iframe.src.startsWith(card.dataset.urlMg) || iframe.src.startsWith(card.dataset.urlEn)
            );
            if (currentCard) {
                const lessonKey = 'lesson_visited_' + currentCard.dataset.lesson;
                localStorage.setItem(lessonKey, 'true');
                localStorage.setItem('last_visited_lesson', iframe.src);
            }
        }
    }
    
    // Page Hide Handler
    function handlePageHide() {
        if (iframe.src) {
            localStorage.setItem('last_visited_lesson', iframe.src);
        }
    }
    
    // Service Worker Registration
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('✓ Service Worker registered');
                
                checkForUpdates();
                
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.action === 'cached') {
                        console.log('✓ Resource cached:', event.data.url);
                    }
                });
            } catch (error) {
                console.error('✗ Service Worker error:', error);
            }
        }
    }
    
    // Check for Updates
    function checkForUpdates() {
        if (!swRegistration) return;
        
        swRegistration.addEventListener('updatefound', () => {
            const newWorker = swRegistration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateNotification();
                }
            });
        });
    }
    
    // Show Update Notification
    function showUpdateNotification() {
        updateNotification.classList.add('show');
    }
    
    // Update Click Handler
    function handleUpdateClick() {
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ action: 'skipWaiting' });
        }
        window.location.reload();
    }
    
    // Setup Install Prompt
    function setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            setTimeout(() => {
                if (!localStorage.getItem('installDismissed')) {
                    installPrompt.classList.add('show');
                }
            }, 5000);
        });
    }
    
    // Install Click Handler
    async function handleInstallClick() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('Install prompt outcome:', outcome);
            deferredPrompt = null;
        }
        installPrompt.classList.remove('show');
    }
    
    // Dismiss Click Handler
    function handleDismissClick() {
        localStorage.setItem('installDismissed', 'true');
        installPrompt.classList.remove('show');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
