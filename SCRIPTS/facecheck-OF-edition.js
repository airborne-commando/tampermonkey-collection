// ==UserScript==
// @name         FaceSpy Image URL Extractor
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Extracts image URLs from FaceSpy results for both mobile and desktop
// @author       Based on original by vin31_, modified for FaceSpy
// @match        https://face-spy.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Helper function to determine rating and color based on similarity/confidence
    // Note: FaceSpy doesn't show confidence percentages in your HTML, so we'll base it on image quality/clarity
    const getRating = () => {
        // Since we don't have confidence scores, we'll use a generic rating
        return { rating: 'Match Found', color: isMobile ? 'green' : '#4caf50' };
    };

    // Extract image URLs from FaceSpy result cards
    const extractImageUrls = (resultCard) => {
        const results = [];
        
        // Get the main image
        const mainImg = resultCard.querySelector('.top-image');
        if (mainImg && mainImg.src) {
            const result = {
                url: mainImg.src,
                domain: 'OnlyFans',
                confidence: 100, // Default since no confidence shown
                rating: 'Match Found',
                color: isMobile ? 'green' : '#4caf50',
                type: 'main'
            };
            results.push(result);
        }
        
        // Get the blurred background image
        const blurBg = resultCard.querySelector('.blur-background');
        if (blurBg) {
            const bgStyle = window.getComputedStyle(blurBg).backgroundImage;
            const urlMatch = bgStyle.match(/url\(["']?([^"']+)["']?\)/);
            if (urlMatch && urlMatch[1]) {
                const result = {
                    url: urlMatch[1],
                    domain: 'OnlyFans',
                    confidence: 100,
                    rating: 'Match Found',
                    color: isMobile ? 'green' : '#4caf50',
                    type: 'background'
                };
                results.push(result);
            }
        }
        
        // Get the OnlyFans profile URL
        const urlBadge = resultCard.querySelector('.url-badge');
        const profileUrl = urlBadge ? urlBadge.textContent.trim() : 'No URL';
        
        return {
            images: results,
            profileUrl: profileUrl
        };
    };

    // MOBILE FUNCTIONALITY
    if (isMobile) {
        // Mobile-specific styles for overlays
        const mobileStyles = `
            .mobile-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, transparent 100%);
                color: white;
                padding: 12px 8px 8px 8px;
                font-size: 14px;
                line-height: 1.4;
                z-index: 1000;
                border-radius: 0 0 8px 8px;
                pointer-events: none;
                transform: translateY(100%);
                transition: transform 0.3s ease;
            }
            .mobile-overlay.visible {
                transform: translateY(0);
            }
            .mobile-overlay a {
                color: #00FFFF;
                text-decoration: none;
                display: block;
                margin-bottom: 4px;
                font-weight: bold;
                pointer-events: all;
                padding: 6px 8px;
                border-radius: 4px;
                background: rgba(0,0,0,0.8);
                font-size: 14px;
            }
            .mobile-overlay a:active {
                background: rgba(0,255,255,0.2);
            }
            .mobile-overlay .rating {
                font-size: 12px;
                font-weight: normal;
            }
            .result-card {
                position: relative !important;
                overflow: hidden !important;
            }
            .mobile-info-panel {
                position: fixed;
                bottom: 10px;
                left: 10px;
                right: 10px;
                background: rgba(0,0,0,0.95);
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 9999;
                font-size: 16px;
                line-height: 1.5;
                max-height: 70vh;
                overflow-y: auto;
                transform: translateY(120%);
                transition: transform 0.3s ease;
                border: 1px solid rgba(0,255,255,0.3);
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            .mobile-info-panel.visible {
                transform: translateY(0);
            }
            .mobile-info-panel .close-btn {
                position: absolute;
                top: 8px;
                right: 12px;
                background: none;
                border: none;
                color: #00FFFF;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
            }
            .mobile-info-panel a {
                color: #00FFFF;
                text-decoration: none;
                display: block;
                margin: 12px 0;
                padding: 10px 12px;
                background: rgba(0,255,255,0.1);
                border-radius: 6px;
                border: 1px solid rgba(0,255,255,0.2);
                word-break: break-all;
                font-size: 16px;
            }
            .mobile-info-panel a:active {
                background: rgba(0,255,255,0.3);
            }
            .mobile-info-panel .url-item {
                margin-bottom: 16px;
            }
            .mobile-overlay .click-hint {
                font-size: 12px;
                color: #aaa;
                margin-top: 4px;
                font-style: italic;
            }
            .data-url-display {
                font-size: 10px;
                color: #888;
                margin-top: 4px;
                word-break: break-all;
                max-height: 60px;
                overflow-y: auto;
            }
        `;

        // Inject mobile styles
        const mobileStyleSheet = document.createElement("style");
        mobileStyleSheet.type = "text/css";
        mobileStyleSheet.innerText = mobileStyles;
        document.head.appendChild(mobileStyleSheet);

        // Create overlay for mobile result cards
        const createMobileOverlay = (resultCard, data) => {
            const overlay = document.createElement("div");
            overlay.classList.add("mobile-overlay");

            const { rating, color } = getRating();
            const shortProfileUrl = data.profileUrl.length > 40 ? 
                data.profileUrl.substring(0, 40) + '...' : 
                data.profileUrl;

            overlay.innerHTML = `
                <div style="color:${color}; pointer-events: none;">
                    ${data.images[0]?.domain || 'OnlyFans'} - ${rating}
                </div>
                <div class="data-url-display" style="pointer-events: none;">
                    Profile: ${shortProfileUrl}
                </div>
                <div class="click-hint" style="pointer-events: none;">Tap for image URLs</div>
            `;

            resultCard.appendChild(overlay);

            // Show overlay with animation after a short delay
            setTimeout(() => {
                overlay.classList.add("visible");
            }, 100);

            return overlay;
        };

        // Create floating info panel
        const createInfoPanel = () => {
            const panel = document.createElement("div");
            panel.classList.add("mobile-info-panel");
            panel.innerHTML = `
                <button class="close-btn">×</button>
                <div id="panel-content"></div>
            `;
            document.body.appendChild(panel);

            // Close button functionality
            panel.querySelector('.close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.remove('visible');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!panel.contains(e.target) && panel.classList.contains('visible')) {
                    panel.classList.remove('visible');
                }
            });

            return panel;
        };

        const infoPanel = createInfoPanel();

        // Add click handler to overlays
        const addOverlayClickHandler = (overlay, data) => {
            overlay.style.pointerEvents = 'all';
            overlay.style.cursor = 'pointer';

            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const imagesContent = data.images.map((image, index) => `
                    <div class="url-item">
                        <div style="color:${image.color}; font-weight:bold;">
                            ${index + 1}. ${image.type.toUpperCase()} Image - ${image.rating}
                        </div>
                        <div class="data-url-display" style="margin: 8px 0; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px;">
                            ${image.url}
                        </div>
                        <button class="copy-btn" style="background: #00FFFF; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;" data-url="${image.url}">
                            Copy Image URL
                        </button>
                    </div>
                `).join('');

                const profileContent = `
                    <div class="url-item">
                        <div style="color:#4caf50; font-weight:bold;">
                            Profile URL
                        </div>
                        <div class="data-url-display" style="margin: 8px 0; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px;">
                            ${data.profileUrl}
                        </div>
                        <button class="copy-btn" style="background: #00FFFF; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;" data-url="${data.profileUrl}">
                            Copy Profile URL
                        </button>
                    </div>
                `;

                infoPanel.querySelector('#panel-content').innerHTML = imagesContent + profileContent;

                // Add copy functionality
                infoPanel.querySelectorAll('.copy-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const url = e.target.getAttribute('data-url');
                        navigator.clipboard.writeText(url).then(() => {
                            e.target.textContent = 'Copied!';
                            setTimeout(() => {
                                e.target.textContent = e.target.getAttribute('data-url').includes('onlyfans.com') ? 
                                    'Copy Profile URL' : 'Copy Image URL';
                            }, 2000);
                        });
                    });
                });

                infoPanel.classList.add('visible');
            });
        };

        // Process all mobile result cards
        const processMobileCards = () => {
            const resultCards = document.querySelectorAll('.result-card');

            resultCards.forEach(card => {
                // Skip if already processed
                if (card.querySelector('.mobile-overlay')) return;

                const data = extractImageUrls(card);
                if (data.images.length > 0) {
                    const overlay = createMobileOverlay(card, data);
                    addOverlayClickHandler(overlay, data);
                }
            });
        };

        // Start processing mobile cards
        const mobileCheckInterval = setInterval(() => {
            if (document.querySelector('.result-card')) {
                processMobileCards();
                // Continue checking for new cards that might load dynamically
                setTimeout(() => {
                    processMobileCards();
                }, 2000);
            }
        }, 1000);
    } else {
        // DESKTOP FUNCTIONALITY

        // CSS Variables for easy theme management
        const desktopStyles = `
            :root {
                --popup-bg: #1e1e1e;
                --popup-color: #00ffff;
                --popup-opacity: 0.95;
                --popup-border: 1px solid rgba(0, 255, 255, 0.2);
                --popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                --popup-radius: 8px;
                --popup-padding: 12px;
                --popup-width: 350px;
                --popup-max-height: 400px;
                --popup-transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .popup {
                position: fixed;
                background: var(--popup-bg);
                color: var(--popup-color);
                opacity: 0;
                border: var(--popup-border);
                box-shadow: var(--popup-shadow);
                border-radius: var(--popup-radius);
                padding: var(--popup-padding);
                width: var(--popup-width);
                max-height: var(--popup-max-height);
                overflow-y: auto;
                pointer-events: auto;
                transition: var(--popup-transition);
                transform: translateY(-10px);
                backdrop-filter: blur(10px);
                z-index: 9999;
            }
            .popup.visible {
                opacity: var(--popup-opacity);
                transform: translateY(0);
            }
            .popup ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .popup li {
                margin: 12px 0;
                padding: 10px;
                background: rgba(0,255,255,0.05);
                border-radius: 6px;
            }
            .popup .data-url {
                font-size: 11px;
                color: #aaa;
                word-break: break-all;
                margin: 8px 0;
                padding: 8px;
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
                max-height: 80px;
                overflow-y: auto;
            }
            .popup .copy-btn {
                background: #00FFFF;
                color: black;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-top: 8px;
                margin-right: 5px;
            }
            .popup .copy-btn:hover {
                background: #00cccc;
            }
            .popup .profile-url {
                font-weight: bold;
                color: #4caf50;
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid rgba(0,255,255,0.2);
            }
        `;

        // Inject desktop styles
        const desktopStyleSheet = document.createElement("style");
        desktopStyleSheet.type = "text/css";
        desktopStyleSheet.innerText = desktopStyles;
        document.head.appendChild(desktopStyleSheet);

        // Create and style the popup window
        const createPopup = () => {
            const popup = document.createElement("div");
            popup.classList.add("popup");
            document.body.appendChild(popup);
            return popup;
        };

        // Function to display results in the popup window
        const displayResultsDesktop = (data, popup, resultCard) => {
            const rect = resultCard.getBoundingClientRect();

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Position directly below the image
            let leftPosition = rect.left;
            let topPosition = rect.bottom + 5;

            // Adjust if popup would go offscreen
            const popupWidth = 350;
            if (leftPosition + popupWidth > viewportWidth - 10) {
                leftPosition = viewportWidth - popupWidth - 10;
            }

            const popupHeight = Math.min(400, (data.images.length + 1) * 120);
            if (topPosition + popupHeight > viewportHeight - 10) {
                topPosition = rect.top - popupHeight - 5;
            }
            if (topPosition < 10) {
                topPosition = 10;
            }

            popup.style.left = `${leftPosition}px`;
            popup.style.top = `${topPosition}px`;

            const imagesList = data.images.map((image, index) => `
                <li>
                    <div style="color:${image.color}; font-weight:bold;">
                        ${index + 1}. ${image.type.toUpperCase()} Image - ${image.rating}
                    </div>
                    <div class="data-url">
                        ${image.url}
                    </div>
                    <button class="copy-btn" data-url="${image.url}">
                        Copy Image URL
                    </button>
                </li>
            `).join('');

            const profileSection = `
                <li class="profile-url">
                    <div style="font-weight:bold;">Profile URL:</div>
                    <div class="data-url">
                        ${data.profileUrl}
                    </div>
                    <button class="copy-btn" data-url="${data.profileUrl}">
                        Copy Profile URL
                    </button>
                </li>
            `;

            popup.innerHTML = `<ul>${imagesList}${profileSection}</ul>`;
            popup.classList.add('visible');

            // Add copy functionality
            popup.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = e.target.getAttribute('data-url');
                    navigator.clipboard.writeText(url).then(() => {
                        e.target.textContent = 'Copied!';
                        setTimeout(() => {
                            e.target.textContent = e.target.getAttribute('data-url').includes('onlyfans.com') ? 
                                'Copy Profile URL' : 'Copy Image URL';
                        }, 2000);
                    });
                });
            });
        };

        // Create the popup window
        const popup = createPopup();

        // Track which elements have listeners attached
        const processedCards = new WeakSet();
        let hoverTimeout;
        let isPopupHovered = false;

        // Add event listeners for all result cards
        const addHoverListeners = () => {
            const resultCards = document.querySelectorAll('.result-card');

            resultCards.forEach(card => {
                if (processedCards.has(card)) return;
                processedCards.add(card);

                card.addEventListener('mouseenter', (e) => {
                    if (isPopupHovered) return;
                    clearTimeout(hoverTimeout);
                    const data = extractImageUrls(card);
                    if (data.images.length > 0) {
                        displayResultsDesktop(data, popup, card);
                    }
                });

                card.addEventListener('mouseleave', (e) => {
                    if (isPopupHovered) return;
                    hoverTimeout = setTimeout(() => {
                        popup.classList.remove('visible');
                    }, 300);
                });
            });

            // Event handler for the popup
            popup.addEventListener('mouseenter', () => {
                isPopupHovered = true;
                clearTimeout(hoverTimeout);
            });

            popup.addEventListener('mouseleave', () => {
                isPopupHovered = false;
                popup.classList.remove('visible');
            });
        };

        // Start adding event listeners
        const desktopCheckInterval = setInterval(() => {
            if (document.querySelector('.result-card')) {
                addHoverListeners();
                clearInterval(desktopCheckInterval);
            }
        }, 1000);

        // Also listen for dynamic content
        const observer = new MutationObserver(() => {
            addHoverListeners();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Add a small indicator that the script is active
    const style = document.createElement('style');
    style.textContent = `
        .result-card:hover {
            outline: 2px solid #00FFFF !important;
            outline-offset: 2px !important;
            transition: outline 0.2s ease !important;
        }
    `;
    document.head.appendChild(style);
})();
