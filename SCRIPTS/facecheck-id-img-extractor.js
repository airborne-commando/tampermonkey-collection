// ==UserScript==
// @name         FaceCheck WebP URL Extractor
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  Extracts WebP image URLs from FaceCheck results for both mobile and desktop
// @author       vin31_ modified by Nthompson096, perplexity.ai and 0wn3dg0d
// @match        https://facecheck.id/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Helper to check if on results page
    const isResultsPage = () => /https:\/\/facecheck\.id\/(?:[a-z]{2})?\#.+/.test(window.location.href);

    // Helper function to determine rating and color based on confidence score
    const getRating = (confidence) => {
        if (confidence >= 90) return { rating: 'Certain Match', color: isMobile ? 'green' : '#4caf50' };
        if (confidence >= 83) return { rating: 'Confident Match', color: isMobile ? 'yellow' : '#ffeb3b' };
        if (confidence >= 70) return { rating: 'Uncertain Match', color: isMobile ? 'orange' : '#ff9800' };
        if (confidence >= 50) return { rating: 'Weak Match', color: isMobile ? 'red' : '#f44336' };
        return { rating: 'No Match', color: isMobile ? 'white' : '#9e9e9e' };
    };

    // Extract WebP URL from a single image element
    const extractWebPUrl = (fimg) => {
        const bgImage = window.getComputedStyle(fimg).backgroundImage;
        // Extract the data URL directly without decoding Base64
        const urlMatch = bgImage.match(/url\("([^"]+)"\)/);
        if (!urlMatch) return null;

        // Get the full data URL (including base64 part)
        const dataUrl = urlMatch[1];

        // Get domain from the image icon in the HTML
        const domainSpan = fimg.querySelector('.topdiv span');
        const domain = domainSpan ? domainSpan.textContent : 'Unknown Domain';

        // Get confidence score
        const distSpan = fimg.querySelector('.dist');
        const confidence = distSpan ? parseInt(distSpan.textContent) : 0;
        const { rating, color } = getRating(confidence);

        return {
            url: dataUrl,
            domain,
            confidence,
            rating,
            color,
            isBase64: dataUrl.includes('base64')
        };
    };

    // Shared URL extraction function (works for both mobile and desktop)
    const extractUrls = (fimg) => {
        const parentAnchor = fimg.closest('a');
        const groupId = parentAnchor ? parentAnchor.getAttribute('data-grp') : null;
        const results = [];

        // If it's a group, collect all elements of the group
        if (groupId) {
            const groupElements = document.querySelectorAll(`a[data-grp="${groupId}"]`);
            groupElements.forEach(groupElement => {
                const groupFimg = groupElement.querySelector('.facediv') || groupElement.querySelector('[id^="fimg"]');
                if (!groupFimg) return;

                const result = extractWebPUrl(groupFimg);
                if (result) results.push(result);
            });
        } else {
            // If it's a standalone element
            const result = extractWebPUrl(fimg);
            if (result) results.push(result);
        }

        return results.sort((a, b) => b.confidence - a.confidence);
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
            .fimg-container {
                position: relative;
                overflow: hidden;
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
            .mobile-info-panel .confidence {
                font-size: 14px;
                margin-top: 6px;
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

        // Create overlay for mobile images
        const createMobileOverlay = (fimg, results) => {
            // Make sure the parent container has relative positioning
            const container = fimg.parentElement;
            if (!container.classList.contains('fimg-container')) {
                container.classList.add('fimg-container');
            }

            const overlay = document.createElement("div");
            overlay.classList.add("mobile-overlay");

            // Show domain, confidence, and click hint
            const topResult = results[0];
            const shortUrl = topResult.url.length > 50 ?
                topResult.url.substring(0, 50) + '...' :
                topResult.url;

            overlay.innerHTML = `
                <div style="color:${topResult.color}; pointer-events: none;">
                    ${topResult.domain} (${topResult.confidence}%) - ${topResult.rating}
                </div>
                <div class="data-url-display" style="pointer-events: none;">
                    ${shortUrl}
                </div>
                <div class="click-hint" style="pointer-events: none;">Tap for more URLs</div>
            `;

            container.appendChild(overlay);

            // Show overlay with animation after a short delay
            setTimeout(() => {
                overlay.classList.add("visible");
            }, 100);

            return overlay;
        };

        // Create floating info panel that shows when tapping on overlay info
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

        // Add click handler to overlays to show detailed info
        const addOverlayClickHandler = (overlay, results) => {
            overlay.style.pointerEvents = 'all';
            overlay.style.cursor = 'pointer';

            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const content = results.map((result, index) => `
                    <div class="url-item">
                        <div style="color:${result.color}; font-weight:bold;">
                            ${index + 1}. ${result.domain} (${result.confidence}%) - ${result.rating}
                        </div>
                        <div class="data-url-display" style="margin: 8px 0; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px;">
                            ${result.url}
                        </div>
                        <button class="copy-btn" style="background: #00FFFF; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;" data-url="${result.url}">
                            Copy Data URL
                        </button>
                    </div>
                `).join('');

                infoPanel.querySelector('#panel-content').innerHTML = content;

                // Add copy functionality
                infoPanel.querySelectorAll('.copy-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const url = e.target.getAttribute('data-url');
                        navigator.clipboard.writeText(url).then(() => {
                            e.target.textContent = 'Copied!';
                            setTimeout(() => {
                                e.target.textContent = 'Copy Data URL';
                            }, 2000);
                        });
                    });
                });

                infoPanel.classList.add('visible');
            });
        };

        // Process all mobile images
        const processMobileImages = () => {
            const fimgElements = document.querySelectorAll('[id^="fimg"]');

            fimgElements.forEach(fimg => {
                // Skip if already processed
                if (fimg.parentElement.querySelector('.mobile-overlay')) return;

                const results = extractUrls(fimg);
                if (results.length > 0) {
                    const overlay = createMobileOverlay(fimg, results);
                    addOverlayClickHandler(overlay, results);
                }
            });
        };

        // Start processing mobile images
        const mobileCheckInterval = setInterval(() => {
            if (isResultsPage() && document.querySelector('[id^="fimg"]')) {
                processMobileImages();
                // Continue checking for new images that might load dynamically
                setTimeout(() => {
                    processMobileImages();
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
	            --popup-radius: 8px; /* Reduced from 12px */
	            --popup-padding: 12px; /* Reduced from 16px */
	            --popup-width: 350px; /* Reduced from 400px */
	            --popup-max-height: 400px; /* Reduced from 500px */
	            --popup-transition: opacity 0.2s ease, transform 0.2s ease; /* Faster */
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
            }
            .popup .copy-btn:hover {
                background: #00cccc;
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
        const displayResultsDesktop = (results, popup, fimg) => {
            const rect = fimg.getBoundingClientRect();
            
            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Position directly below the image
            let leftPosition = rect.left;
            let topPosition = rect.bottom - 5; // Just below the image
            
            // Adjust if popup would go offscreen to the right
            const popupWidth = 400; // Should match --popup-width CSS variable
            if (leftPosition + popupWidth > viewportWidth - 10) {
                // Try placing on left side instead
                if (rect.left - popupWidth > 10) {
                    leftPosition = rect.left - popupWidth - 5;
                } else {
                    // If neither side works, position at viewport edge
                    leftPosition = viewportWidth - popupWidth - 10;
                }
            }
            
            // Adjust if popup would go offscreen vertically
            const popupHeight = Math.min(500, results.length * 100); // Estimate height
            if (topPosition + popupHeight > viewportHeight - 10) {
                topPosition = viewportHeight - popupHeight - 10;
            }
            if (topPosition < 10) {
                topPosition = 10;
            }
            
            popup.style.left = `${leftPosition}px`;
            popup.style.top = `${topPosition}px`;

            const resultsList = results.map((result, index) => `
                <li>
                    <div style="color:${result.color}; font-weight:bold;">
                        ${index + 1}. ${result.domain} (${result.confidence}%) - ${result.rating}
                    </div>
                    <div class="data-url">
                        ${result.url}
                    </div>
                    <button class="copy-btn" data-url="${result.url}">
                        Copy Data URL
                    </button>
                </li>
            `).join('');

            popup.innerHTML = `<ul>${resultsList}</ul>`;
            popup.classList.add('visible');

            // Add copy functionality
            popup.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = e.target.getAttribute('data-url');
                    navigator.clipboard.writeText(url).then(() => {
                        e.target.textContent = 'Copied!';
                        setTimeout(() => {
                            e.target.textContent = 'Copy Data URL';
                        }, 2000);
                    });
                });
            });
        };

        // Create the popup window
        const popup = createPopup();

        // Track which elements have listeners attached
        const processedFimgs = new WeakSet();
        let hoverTimeout;
        let isPopupHovered = false;

        // Add event listeners for all fimg elements
        const addHoverListeners = () => {
            const fimgElements = document.querySelectorAll('[id^="fimg"]');

            fimgElements.forEach(fimg => {
                if (processedFimgs.has(fimg)) return;
                processedFimgs.add(fimg);

                fimg.addEventListener('mouseenter', () => {
                    if (isPopupHovered) return;
                    clearTimeout(hoverTimeout);
                    const results = extractUrls(fimg);
                    if (results.length > 0) {
                        displayResultsDesktop(results, popup, fimg);
                    }
                });

                fimg.addEventListener('mouseleave', () => {
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

        // Start adding event listeners after the page loads
        const desktopCheckInterval = setInterval(() => {
            if (isResultsPage() && document.querySelector('[id^="fimg"]')) {
                addHoverListeners();
            }
        }, 1000);
    }
})();
