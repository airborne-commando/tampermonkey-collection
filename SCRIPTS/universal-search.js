// ==UserScript==
// @name         Universal Background Check Exporter
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/universal-search.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/universal-search.js
// @version      2.2.8
// @description  Export results from multiple background check sites: FastBackgroundCheck, FastPeopleSearch, ZabaSearch, and Vote.org with API integration
// @author       airborne-commando
// @match        https://www.whitepages.com/*
// @match        https://www.fastbackgroundcheck.com/*
// @match        https://fastbackgroundcheck.com/*
// @match        https://www.fastpeoplesearch.com/*
// @match        https://www.zabasearch.com/*
// @match        https://verify.vote.org/your-status
// @match        https://verify.vote.org/
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      verify.vote.org
// @connect      vote.org
// @connect      maps.googleapis.com
// @license      GPL 3.0
// @run-at       document-end
// ==/UserScript==

(function() {

    'use strict';
    GM_addStyle(`
        @media (max-width: 600px) {
            /* Target inputs inside the container - override inline font-size */
            div[style*="background: rgb(240, 230, 255)"] input {
                font-size: 10px !important;
            }
            /* Target div with font-size: 10px and other text elements inside container */
            div[style*="background: rgb(240, 230, 255)"] > div[style*="font-size: 10px"],
            div[style*="background: rgb(240, 230, 255)"] > button,
            div[style*="background: rgb(240, 230, 255)"] > div[id="ubcVoteResults"] {
                font-size: 10px !important;
            }
        }
    `);

        // Inject CSS media query for mobile font size override
    GM_addStyle(`
        @media (max-width: 600px) {
            /* Target inputs within the container */
            div[style*="background: rgb(248, 249, 250)"] input {
                font-size: 10px !important;
            }
            /* Target the font-size: 10px div and other text/buttons inside the container */
            div[style*="background: rgb(248, 249, 250)"] > div[style*="font-size: 10px"],
            div[style*="background: rgb(248, 249, 250)"] > button,
            div[style*="background: rgb(248, 249, 250)"] > div[id="ubcSearchResults"] {
                font-size: 10px !important;
            }
        }
    `);

    GM_addStyle(`
        @media (max-width: 600px) {
            /* Target inputs and selects inside Age Calculator container */
            div[style*="background: rgb(232, 246, 243)"] input,
            div[style*="background: rgb(232, 246, 243)"] select {
                font-size: 10px !important;
            }
            /* Target button, result div, and any small font-size text */
            div[style*="background: rgb(232, 246, 243)"] > button,
            div[style*="background: rgb(232, 246, 243)"] > div[id="ubcAgeResults"],
            div[style*="background: rgb(232, 246, 243)"] > div[style*="font-size: 10px"] {
                font-size: 10px !important;
            }
        }
    `);

    // Search Utility Class
    class SearchUtility {
        static formatNameForFPSFBC(name) {
            // For FPS and FBC: replace spaces with hyphens but keep existing hyphens
            return name.toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

    // Search Utility Class
        static formatNameForWP(name) {
            // For FPS and FBC: replace spaces with hyphens but keep existing hyphens
            return name.toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatNameForZaba(name) {
            // For Zaba: keep hyphens and spaces become hyphens
            return name.toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatLocation(location) {
            // Format location for URL
            return location.toLowerCase()
                .trim()
                .replace(/\s*,\s*/g, '-')
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatStateForZaba(state) {
            // Zaba uses full state names, not abbreviations
            const stateMap = {
                'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
                'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
                'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
                'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
                'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
                'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new-hampshire', 'nj': 'new-jersey',
                'nm': 'new-mexico', 'ny': 'new-york', 'nc': 'north-carolina', 'nd': 'north-dakota', 'oh': 'ohio',
                'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode-island', 'sc': 'south-carolina',
                'sd': 'south-dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
                'va': 'virginia', 'wa': 'washington', 'wv': 'west-virginia', 'wi': 'wisconsin', 'wy': 'wyoming'
            };

            const stateLower = state.toLowerCase().trim();
            return stateMap[stateLower] || this.formatLocation(state);
        }

        static generateSearchURLs(firstName, lastName, city, state) {
            const fullName = `${firstName} ${lastName}`;
            const formattedNameFPSFBC = this.formatNameForFPSFBC(fullName);
            const formattedNameWP = this.formatNameForWP(fullName);
            const formattedNameZaba = this.formatNameForZaba(fullName);
            const formattedState = this.formatLocation(state);
            const formattedStateZaba = this.formatStateForZaba(state);
            const formattedCityState = city ? this.formatLocation(`${city}-${state}`) : '';

            const urls = {
                fastpeoplesearch: [],
                fastbackgroundcheck: [],
                zabasearch: [],
                whitepages: []
            };

            // FastPeopleSearch URLs
            if (formattedCityState) {
                urls.fastpeoplesearch.push(`https://www.fastpeoplesearch.com/name/${formattedNameFPSFBC}_${formattedCityState}`);
            }
            // Always include state-only search for FPS
            urls.fastpeoplesearch.push(`https://www.fastpeoplesearch.com/name/${formattedNameFPSFBC}_${formattedState}`);

            // FastBackgroundCheck URLs
            if (formattedCityState) {
                urls.fastbackgroundcheck.push(`https://www.fastbackgroundcheck.com/people/${formattedNameFPSFBC}/${formattedCityState}`);
            }
            // Always include state-only search for FBC
            urls.fastbackgroundcheck.push(`https://www.fastbackgroundcheck.com/people/${formattedNameFPSFBC}/${formattedState}`);

            // ZabaSearch URLs
            if (city) {
                const formattedCity = this.formatLocation(city);
                urls.zabasearch.push(`https://www.zabasearch.com/people/${formattedNameZaba}/${formattedStateZaba}/${formattedCity}/`);
            }
            // Always include state-only search for Zaba
            urls.zabasearch.push(`https://www.zabasearch.com/people/${formattedNameZaba}/${formattedStateZaba}/`);

            // whitepages URLs
            if (formattedCityState) {
                urls.whitepages.push(`https://www.whitepages.com/name/${formattedNameWP}/${formattedCityState}`);
            }
            // Always include state-only search for FPS
            urls.whitepages.push(`https://www.whitepages.com/name/${formattedNameWP}/${formattedState}`);

            return urls;
        }

        static validateName(name) {
            return name && name.trim().length > 0;
        }

        static validateState(state) {
            return state && state.trim().length > 0;
        }

        static getStateAbbreviation(stateName) {
            const stateMap = {
                'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
                'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
                'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
                'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
                'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
                'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
                'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
                'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
                'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
                'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
            };

            const normalized = stateName.toLowerCase().trim();
            return stateMap[normalized] || null;
        }
    }

// Age Calculator Utility Class
class AgeCalculator {
    static calculateAge(birthDate) {
        // birthDate can be in various formats: Date object, string, or year
        let birthDateObj;

        if (birthDate instanceof Date) {
            birthDateObj = birthDate;
        } else if (typeof birthDate === 'string') {
            birthDateObj = new Date(birthDate);
        } else if (typeof birthDate === 'number') {
            // Assume it's a year, create date for Jan 1 of that year
            birthDateObj = new Date(birthDate, 0, 1);
        } else {
            return { error: 'Invalid date format' };
        }

        // Check if date is valid
        if (isNaN(birthDateObj.getTime())) {
            return { error: 'Invalid date' };
        }

        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();

        // Adjust age if birthday hasn't occurred this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
            age--;
        }

        // Calculate exact age with months and days
        let months = today.getMonth() - birthDateObj.getMonth();
        let days = today.getDate() - birthDateObj.getDate();

        if (days < 0) {
            months--;
            // Get days in previous month
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
        }

        if (months < 0) {
            months += 12;
        }

        return {
            years: age,
            months: months,
            days: days,
            exactAge: `${age} years, ${months} months, ${days} days`,
            isAdult: age >= 18,
            isSenior: age >= 65
        };
    }

    static calculateBirthYearFromAge(age) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();

        // If it's early in the year, they might not have had their birthday yet
        const birthYear = currentYear - age;
        const birthYearPrevious = currentYear - age - 1;

        return {
            currentYear: currentYear,
            possibleBirthYears: [birthYear, birthYearPrevious],
            exactBirthYear: `If age ${age} in ${currentYear}, born in ${birthYear} or ${birthYearPrevious}`,
            ageVerification: `Person born in ${birthYear} would be ${currentYear - birthYear} in ${currentYear}`,
            birthYearRange: `${birthYearPrevious}-${birthYear}`
        };
    }

    static parseDateString(dateString) {
        // Try to parse various date formats
        const formats = [
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
            /(\d{1,2})-(\d{1,2})-(\d{4})/,   // DD-MM-YYYY
            /(\w+)\s+(\d{1,2}),\s+(\d{4})/   // Month DD, YYYY
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                if (format === formats[0]) { // MM/DD/YYYY
                    return new Date(match[3], match[1] - 1, match[2]);
                } else if (format === formats[1]) { // YYYY-MM-DD
                    return new Date(match[1], match[2] - 1, match[3]);
                } else if (format === formats[2]) { // DD-MM-YYYY
                    return new Date(match[3], match[2] - 1, match[1]);
                } else if (format === formats[3]) { // Month DD, YYYY
                    const monthNames = ["january", "february", "march", "april", "may", "june",
                                      "july", "august", "september", "october", "november", "december"];
                    const monthIndex = monthNames.indexOf(match[1].toLowerCase());
                    if (monthIndex !== -1) {
                        return new Date(match[3], monthIndex, match[2]);
                    }
                }
            }
        }

        return null;
    }

    static validateAge(age) {
        const ageNum = parseInt(age);
        return !isNaN(ageNum) && ageNum >= 0 && ageNum <= 120;
    }
}
    // Google Maps Utility Class
    class MapsUtility {
    static async geocodeAddress(address) {
        return new Promise((resolve, reject) => {
            // Simple geocoding using Google Maps API
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyC1lwGqZqQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1`;

            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        const data = JSON.parse(response.responseText);
                        if (data.status === 'OK' && data.results.length > 0) {
                            const location = data.results[0].geometry.location;
                            resolve({
                                success: true,
                                lat: location.lat,
                                lng: location.lng,
                                formattedAddress: data.results[0].formatted_address
                            });
                        } else {
                            resolve({
                                success: false,
                                error: data.status
                            });
                        }
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${response.status}`
                        });
                    }
                },
                onerror: function(error) {
                    resolve({
                        success: false,
                        error: 'Geocoding request failed'
                    });
                }
            });
        });
    }

    static generateStaticMapUrl(lat, lng, zoom = 14, width = 300, height = 200) {
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:red%7C${lat},${lng}&key=AIzaSyC1lwGqZqQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1`;
    }

    static generateGoogleMapsLink(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    static generateStreetViewUrl(lat, lng) {
        return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }

    static parseAddressComponents(address) {
        // Simple address parsing for common formats
        const patterns = [
            /(\d+)\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/i, // 123 Main St, City, ST 12345
            /([^,]+),\s*([^,]+),\s*([A-Z]{2})/i, // City, ST
            /([^,]+),\s*([A-Z]{2})/i // City, ST
        ];

        for (const pattern of patterns) {
            const match = address.match(pattern);
            if (match) {
                return {
                    street: match[1] || '',
                    city: match[2] || '',
                    state: match[3] || '',
                    zip: match[4] || ''
                };
            }
        }
        return null;
    }
}

    // Vote.org API Integration Class
    class VoteOrgAPI {
        static async checkVoterStatus(voterData) {
            return new Promise((resolve, reject) => {
                const url = 'https://verify.vote.org/your-status';

                // Default values
                const data = {
                    first_name: voterData.firstName || '',
                    last_name: voterData.lastName || '',
                    street_address: voterData.streetAddress || '',
                    city: voterData.city || '',
                    state_abbr: voterData.state || '',
                    zip_5: voterData.zipCode || '',
                    email: voterData.email || 'tahis60368@haotuwu.com',
                    date_of_birth_month: '01',
                    date_of_birth_day: '01',
                    date_of_birth_year: voterData.dobYear || '',
                    phone_number: voterData.phone || '',
                    agreed_to_terms: '1'
                };

                // Build form data
                const formData = Object.keys(data)
                    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
                    .join('&');

                GM_xmlhttpRequest({
                    method: "POST",
                    url: url,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                    },
                    data: formData,
                    onload: function(response) {
                        if (response.status === 200) {
                            resolve({
                                success: true,
                                status: response.status,
                                responseText: response.responseText,
                                finalUrl: response.finalUrl
                            });
                        } else {
                            resolve({
                                success: false,
                                status: response.status,
                                error: `HTTP ${response.status}`,
                                responseText: response.responseText
                            });
                        }
                    },
                    onerror: function(error) {
                        resolve({
                            success: false,
                            error: 'Request failed',
                            details: error
                        });
                    },
                    ontimeout: function() {
                        resolve({
                            success: false,
                            error: 'Request timeout'
                        });
                    }
                });
            });
        }

        static parseVoterResponse(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const result = {
                type: 'voter_registration',
                status: 'unknown',
                isRegistered: false,
                registrationStatus: 'Unknown',
                source: 'api'
            };

            // Check for registered voter indicators
            const hasRegisteredClass = doc.querySelector('.registered-lead') !== null;
            const hasGreenCheck = doc.querySelector('.green-check') !== null;
            const hasRegisteredText = doc.querySelector('h2')?.textContent.includes('You are registered to vote');

            // Check for positive confirmation in the main content
            const bodyText = doc.body.textContent;
            const hasPositiveConfirmation = bodyText.includes('is registered to vote at') &&
                                           !bodyText.includes('could not confirm') &&
                                           !bodyText.includes('do NOT show');

            // Check for not registered indicators
            const hasNotRegisteredClass = doc.querySelector('.not-registered') !== null;
            const hasNotRegisteredLead = doc.querySelector('.not-registered-lead') !== null;
            const hasRedCross = doc.querySelector('.red-cross') !== null;
            const hasNegativeIndicators = bodyText.includes('We could not confirm that you are registered to vote') ||
                                         bodyText.includes('Our records do NOT show that') ||
                                         bodyText.includes('is not registered to vote at');

            if (hasRegisteredClass || hasGreenCheck || hasRegisteredText || hasPositiveConfirmation) {
                result.status = 'found';
                result.isRegistered = true;
                result.registrationStatus = 'Registered to Vote';

                // Extract voter details
                const nameElement = doc.querySelector('.address-block b');
                if (nameElement) {
                    result.fullName = nameElement.textContent.trim();
                }

                const addressElement = doc.querySelector('.ldv-address b');
                if (addressElement) {
                    result.registrationAddress = addressElement.textContent.trim();
                }
            } else if (hasNotRegisteredClass || hasNotRegisteredLead || hasRedCross || hasNegativeIndicators) {
                result.status = 'not_found';
                result.isRegistered = false;
                result.registrationStatus = 'Not Registered - Could Not Confirm';

                // Extract name from the address block
                const nameElement = doc.querySelector('.address-block b');
                if (nameElement) {
                    result.fullName = nameElement.textContent.trim();
                }

                const addressElement = doc.querySelector('.ldv-address b');
                if (addressElement) {
                    result.registrationAddress = addressElement.textContent.trim();
                }
            } else {
                result.status = 'error';
                result.registrationStatus = 'Unable to determine status';
            }

            return result;
        }
    }

    // Base Extractor Class
    class BaseExtractor {
        extractData() {
            return {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                pageTitle: document.title,
                results: [],
                pageType: 'unknown'
            };
        }

        convertToText(data, scope) {
            return 'Text export not implemented for this site';
        }
    }

    // FastBackgroundCheck Extractor
    class FastBackgroundCheckExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Check if this is a search results page with person containers
            if (document.querySelector('.person-container, [class*="person"]')) {
                data.results = this.extractSearchResultsData();
                data.pageType = 'search_results';
            }
            // Check for individual person details page
            else if (document.querySelector('.person-details, .profile-container')) {
                const personData = this.extractPersonDetailsData();
                if (personData) {
                    data.results.push(personData);
                }
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (document.querySelector('.no-results, .no-records, .not-found')) {
                data.results = [{ status: 'no_results', message: 'No records found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractSearchResultsData() {
            const people = [];
            const personSelectors = [
                '.person-container',
                '.people-list li',
                '[class*="person"]',
                '.result-item',
                '.record-item'
            ];

            let personElements = [];
            personSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    personElements = elements;
                }
            });

            if (personElements.length === 0) {
                personElements = document.querySelectorAll('li');
            }

            personElements.forEach((element, index) => {
                const person = {
                    type: 'search_result',
                    status: 'found',
                    id: element.id || `person_${index}`
                };

                // Extract name
                const nameSelectors = ['h1', 'h2', 'h3', 'h4', '.name', '.person-name', '.full-name'];
                nameSelectors.forEach(selector => {
                    const nameElement = element.querySelector(selector);
                    if (nameElement && !person.name) {
                        person.name = nameElement.textContent.trim();
                    }
                });

                // Extract location
                const locationSelectors = ['.location', '.address', '.city-state', '[class*="location"]'];
                locationSelectors.forEach(selector => {
                    const locationElement = element.querySelector(selector);
                    if (locationElement && !person.location) {
                        person.location = locationElement.textContent.trim();
                    }
                });

                // Extract age
                const ageText = element.textContent.match(/Age:\s*(\d+)/i);
                if (ageText) {
                    person.age = ageText[1];
                }

                // Extract addresses
                const addressLinks = element.querySelectorAll('a[href*="/address/"], a[href*="address"]');
                const addresses = [];
                addressLinks.forEach(link => {
                    const addressText = link.textContent.trim();
                    if (addressText && addressText.length > 5) {
                        addresses.push({
                            address: addressText,
                            url: link.href
                        });
                    }
                });
                if (addresses.length > 0) {
                    person.addresses = addresses;
                }

                // Extract phone numbers
                const phoneLinks = element.querySelectorAll('a[href*="/phone/"], a[href*="tel:"], a[href*="phone"]');
                const phones = [];
                phoneLinks.forEach(link => {
                    const phoneText = link.textContent.trim();
                    if (phoneText && phoneText.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/)) {
                        phones.push({
                            number: phoneText,
                            url: link.href
                        });
                    }
                });
                if (phones.length > 0) {
                    person.phones = phones;
                }

                // Extract relatives
                const relativeLinks = element.querySelectorAll('a[href*="/people/"], a[href*="name="]');
                const relatives = [];
                relativeLinks.forEach(link => {
                    if (!link.textContent.includes(person.name)) {
                        relatives.push({
                            name: link.textContent.trim(),
                            url: link.href
                        });
                    }
                });
                if (relatives.length > 0) {
                    person.relatives = relatives;
                }

                // Extract details URL
                const detailsLink = element.querySelector('a[href*="/people/"], a[href*="/person/"], a[href*="id="]');
                if (detailsLink) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name || person.addresses || person.phones) {
                    people.push(person);
                }
            });

            return people;
        }

        extractPersonDetailsData() {
            const person = {
                type: 'detailed_record',
                status: 'found'
            };

            // Extract name from various possible elements
            const nameSelectors = ['h1', 'h2', '.person-name', '.full-name', '.profile-name'];
            nameSelectors.forEach(selector => {
                const nameElement = document.querySelector(selector);
                if (nameElement && !person.name) {
                    person.name = nameElement.textContent.trim();
                }
            });

            // Extract all sections with potential data
            const sections = document.querySelectorAll('.person-info, .profile-section, .details-section, .card, .info-block');

            sections.forEach(section => {
                const text = section.textContent.toLowerCase();

                // Age information
                if (text.includes('age') && !person.age) {
                    const ageMatch = section.textContent.match(/\b(\d+)\s*years?\b/i);
                    if (ageMatch) {
                        person.age = ageMatch[1];
                    }
                }

                // Address information
                if ((text.includes('address') || text.includes('location')) && !person.addresses) {
                    const addressElements = section.querySelectorAll('a, span, div');
                    addressElements.forEach(el => {
                        const addressText = el.textContent.trim();
                        if (addressText.length > 10 && addressText.match(/\d+/)) {
                            if (!person.addresses) person.addresses = [];
                            person.addresses.push({
                                address: addressText,
                                type: text.includes('current') ? 'current' : 'past'
                            });
                        }
                    });
                }

                // Phone information
                if (text.includes('phone') && !person.phones) {
                    const phoneMatches = section.textContent.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/g);
                    if (phoneMatches) {
                        person.phones = phoneMatches.map(number => ({ number: number.trim() }));
                    }
                }
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        convertToText(data, scope) {
            let text = `FASTBACKGROUNDCHECK EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Records Count: ${data.results.length}\n`;
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RECORD ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.addresses && result.addresses.length > 0) {
                    text += `Addresses:\n`;
                    result.addresses.forEach(addr => {
                        text += `  - ${addr.address}\n`;
                    });
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones:\n`;
                    result.phones.forEach(phone => {
                        text += `  - ${phone.number}\n`;
                    });
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join(', ')}\n`;
                }

                if (result.detailsUrl) {
                    text += `Details URL: ${result.detailsUrl}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // FastPeopleSearch Extractor
    class FastPeopleSearchExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Check if this is a people list page
            if (document.querySelector('.people-list')) {
                const peopleList = document.querySelector('.people-list');
                data.results = this.extractPeopleListData(peopleList);
                data.pageType = 'people_list';
            }
            // Check for individual person details page
            else if (document.querySelector('.card-details')) {
                const personCards = document.querySelectorAll('.card-details');
                personCards.forEach((card, index) => {
                    const personData = this.extractPersonDetailsData(card);
                    if (personData) {
                        data.results.push(personData);
                    }
                });
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (document.querySelector('.no-results')) {
                data.results = [{ status: 'no_results', message: 'No people found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractPeopleListData(listElement) {
            const people = [];
            const cards = listElement.querySelectorAll('.card');

            cards.forEach((card, index) => {
                const person = {
                    type: 'list_person',
                    status: 'found',
                    id: card.id || `person_${index}`
                };

                // Extract basic info from card-title
                const titleElement = card.querySelector('.card-title');
                if (titleElement) {
                    const nameElement = titleElement.querySelector('.larger');
                    if (nameElement) {
                        person.name = nameElement.textContent.trim();
                    }

                    const locationElement = titleElement.querySelector('.grey');
                    if (locationElement) {
                        person.location = locationElement.textContent.trim();
                    }
                }

                // Extract all sections by finding h3 elements and their content
                const sections = card.querySelectorAll('h3');

                sections.forEach(section => {
                    const sectionText = section.textContent.trim();

                    // Age section
                    if (sectionText.includes('Age:')) {
                        const ageContent = this.getSectionContent(section);
                        if (ageContent) {
                            person.age = ageContent.replace(':', '').trim();
                        }
                    }

                    // Full Name section
                    else if (sectionText.includes('Full Name:')) {
                        const fullNameContent = this.getSectionContent(section);
                        if (fullNameContent) {
                            person.fullName = fullNameContent.trim();
                        }
                    }

                    // Current Home Address section
                    else if (sectionText.includes('Current Home Address:')) {
                        const addressLink = section.parentElement.querySelector('a[href*="/address/"]');
                        if (addressLink) {
                            const addressLines = addressLink.textContent.trim().split('\n').map(line => line.trim());
                            person.currentAddress = {
                                address: addressLines.join(' ').replace(/\s+/g, ' '),
                                url: addressLink.href
                            };
                        }
                    }

                    // Past Addresses section
                    else if (sectionText.includes('Past Addresses:')) {
                        const pastAddresses = [];
                        const addressLinks = section.parentElement.querySelectorAll('a[href*="/address/"]');
                        addressLinks.forEach(link => {
                            const isCurrentAddress = link.closest('h3') && link.closest('h3').textContent.includes('Current Home Address:');
                            if (!isCurrentAddress) {
                                const addressLines = link.textContent.trim().split('\n').map(line => line.trim());
                                const addressText = addressLines.join(' ').replace(/\s+/g, ' ');
                                pastAddresses.push({
                                    address: addressText,
                                    url: link.href
                                });
                            }
                        });

                        if (pastAddresses.length > 0) {
                            person.pastAddresses = pastAddresses;
                        }
                    }

                    // Phone section
                    else if (sectionText.includes('Phone:')) {
                        const phones = [];
                        const phoneLinks = section.parentElement.querySelectorAll('a[href*="/phone/"], a[href*="/tel/"]');
                        phoneLinks.forEach(link => {
                            const phoneText = link.textContent.trim();
                            phones.push({
                                number: phoneText,
                                url: link.href
                            });
                        });

                        if (phones.length > 0) {
                            person.phones = phones;
                        }
                    }

                    // AKA section
                    else if (sectionText.includes('AKA:')) {
                        const akas = [];
                        const akaSpans = section.parentElement.querySelectorAll('.nowrap');
                        akaSpans.forEach(aka => {
                            if (aka.textContent.trim()) {
                                akas.push(aka.textContent.trim());
                            }
                        });

                        if (akas.length > 0) {
                            person.aliases = akas;
                        }
                    }

                    // Relatives section
                    else if (sectionText.includes('Relatives:')) {
                        const relatives = [];
                        const relativeLinks = section.parentElement.querySelectorAll('a[href*="/name/"]');
                        relativeLinks.forEach(link => {
                            relatives.push({
                                name: link.textContent.trim(),
                                url: link.href
                            });
                        });

                        if (relatives.length > 0) {
                            person.relatives = relatives;
                        }
                    }
                });

                // Extract view details link
                const detailsLink = card.querySelector('a.link-to-details, a[href*="_id_"]');
                if (detailsLink) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name) {
                    people.push(person);
                }
            });

            return people;
        }

        getSectionContent(sectionElement) {
            let content = '';
            let nextSibling = sectionElement.nextSibling;

            while (nextSibling) {
                if (nextSibling.nodeType === Node.TEXT_NODE) {
                    content += nextSibling.textContent;
                } else if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                    if (nextSibling.tagName === 'H3') {
                        break;
                    }
                    if (nextSibling.tagName === 'BR') {
                        content += ' ';
                    } else {
                        content += nextSibling.textContent;
                    }
                }
                nextSibling = nextSibling.nextSibling;
            }

            return content.trim();
        }

        extractPersonDetailsData(cardElement) {
            const person = {
                type: 'detailed_person',
                status: 'found'
            };

            // Extract name from h1 or h2
            const nameElement = cardElement.querySelector('h1, h2');
            if (nameElement) {
                person.name = nameElement.textContent.trim();
            }

            // Extract basic info sections
            const sections = cardElement.querySelectorAll('.card-body, .person-info');
            sections.forEach(section => {
                this.extractDetailedInfo(section, person);
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        extractDetailedInfo(section, person) {
            const headings = section.querySelectorAll('h3, h4, strong');

            headings.forEach(heading => {
                const text = heading.textContent.toLowerCase();
                const nextElement = heading.nextElementSibling;

                if (text.includes('age') && nextElement) {
                    person.age = nextElement.textContent.trim();
                } else if (text.includes('address') && nextElement) {
                    if (!person.addresses) person.addresses = [];
                    person.addresses.push(nextElement.textContent.trim());
                } else if (text.includes('phone') && nextElement) {
                    if (!person.phones) person.phones = [];
                    person.phones.push(nextElement.textContent.trim());
                }
            });
        }

        convertToText(data, scope) {
            let text = `FASTPEOPLESEARCH EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Results Count: ${data.results.length}\n`;
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RESULT ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Full Name: ${result.fullName || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.currentAddress) {
                    text += `Current Address: ${result.currentAddress.address}\n`;
                }

                if (result.pastAddresses && result.pastAddresses.length > 0) {
                    text += `Past Addresses: ${result.pastAddresses.map(addr => addr.address).join('; ')}\n`;
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones: ${result.phones.map(phone => phone.number).join('; ')}\n`;
                }

                if (result.aliases && result.aliases.length > 0) {
                    text += `Aliases: ${result.aliases.join('; ')}\n`;
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join('; ')}\n`;
                }

                if (result.detailsUrl) {
                    text += `Details URL: ${result.detailsUrl}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // ZabaSearch Extractor
    class ZabaSearchExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();
            this.extractLocationInfo(data);

            // Check if this is a search results page with multiple people
            if (this.isSearchResultsPage()) {
                data.results = this.extractSearchResultsData();
                data.pageType = 'search_results';
            }
            // Check for individual person details page
            else if (this.isPersonDetailsPage()) {
                const personData = this.extractPersonDetailsData();
                if (personData) {
                    data.results.push(personData);
                }
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (this.isNoResultsPage()) {
                data.results = [{ status: 'no_results', message: 'No records found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractLocationInfo(data) {
            const urlParts = window.location.pathname.split('/').filter(part => part);
            data.searchLocation = {};

            if (urlParts.length >= 2 && urlParts[0] === 'people') {
                data.searchQuery = urlParts[1];

                if (urlParts.length >= 3) {
                    data.searchLocation.state = urlParts[2];
                }
                if (urlParts.length >= 4) {
                    data.searchLocation.cityOrCounty = urlParts[3];
                }
            }

            // Extract from breadcrumbs
            const breadcrumbs = document.querySelectorAll('#breadcrumbs li');
            if (breadcrumbs.length > 0) {
                data.breadcrumbs = Array.from(breadcrumbs).map(li => li.textContent.trim()).filter(text => text);
                const breadcrumbText = data.breadcrumbs.join(' ');
                if (breadcrumbText.includes('Pennsylvania') || data.breadcrumbs.some(b => b === 'Pennsylvania')) {
                    data.searchLocation.state = 'Pennsylvania';
                }
                if (breadcrumbText.includes('Erie') || data.breadcrumbs.some(b => b === 'Erie')) {
                    data.searchLocation.cityOrCounty = 'Erie';
                }
            }

            // Extract from page title
            const titleMatch = document.title.match(/in\s+([^,]+)(?:,\s*([^|-]+))?/);
            if (titleMatch) {
                if (titleMatch[2]) {
                    data.searchLocation.cityOrCounty = titleMatch[1].trim();
                    data.searchLocation.state = titleMatch[2].trim();
                } else if (titleMatch[1]) {
                    data.searchLocation.state = titleMatch[1].trim();
                }
            }
        }

        isSearchResultsPage() {
            return document.querySelectorAll('.person, .person-container, [class*="person"]').length > 1 ||
                   document.querySelector('.resultsbox') !== null ||
                   document.querySelector('h1')?.textContent.includes('record found') ||
                   document.querySelector('h1')?.textContent.includes('records found');
        }

        isPersonDetailsPage() {
            return document.querySelector('.person, .person-container') !== null &&
                   document.querySelectorAll('.person, .person-container').length === 1 &&
                   document.querySelector('.section-box') !== null;
        }

        isNoResultsPage() {
            return document.querySelector('.no-results, .no-records, .not-found') !== null ||
                   document.querySelector('h1')?.textContent.includes('No results') ||
                   document.querySelector('h1')?.textContent.includes('No records');
        }

        extractSearchResultsData() {
            const people = [];
            const personSelectors = [
                '.person',
                '.person-container',
                '.resultsbox .person',
                '#container-result .person',
                '[class*="person-"]'
            ];

            let personElements = [];
            personSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    personElements = elements;
                }
            });

            if (personElements.length === 0) {
                personElements = document.querySelectorAll('.result-item, .record-item, li');
            }

            personElements.forEach((element, index) => {
                const person = {
                    type: 'search_result',
                    status: 'found',
                    id: element.getAttribute('data-id') || element.id || `person_${index}`
                };

                // Extract name from ZabaSearch structure
                const nameElement = element.querySelector('#container-name h2 a, h2 a, .name, .person-name');
                if (nameElement) {
                    person.name = nameElement.textContent.trim();
                }

                // Extract age
                const ageElement = element.querySelector('h3');
                if (ageElement && ageElement.previousElementSibling &&
                    ageElement.previousElementSibling.textContent.includes('Age')) {
                    person.age = ageElement.textContent.trim();
                } else {
                    const ageMatch = element.textContent.match(/Age\s*:\s*(\d+)/i);
                    if (ageMatch) {
                        person.age = ageMatch[1];
                    }
                }

                // Extract phone numbers
                const phoneLinks = element.querySelectorAll('a[href*="/phone/"]');
                const phones = [];
                phoneLinks.forEach(link => {
                    const phoneText = link.textContent.trim();
                    if (phoneText && phoneText.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/)) {
                        phones.push({
                            number: phoneText,
                            url: link.href
                        });
                    }
                });
                if (phones.length > 0) {
                    person.phones = phones;
                }

                // Extract email addresses
                const emailElements = element.querySelectorAll('.showMore-list li:not(:has(a))');
                const emails = [];
                emailElements.forEach(el => {
                    const emailText = el.textContent.trim();
                    if (emailText && emailText.includes('@')) {
                        emails.push(emailText);
                    }
                });
                if (emails.length > 0) {
                    person.emails = emails;
                }

                // Extract relatives
                const relativeLinks = element.querySelectorAll('a[href*="/people/"]');
                const relatives = [];
                relativeLinks.forEach(link => {
                    const name = link.textContent.trim();
                    if (name && (!person.name || !name.includes(person.name))) {
                        relatives.push({
                            name: name,
                            url: link.href
                        });
                    }
                });
                if (relatives.length > 0) {
                    person.relatives = relatives;
                }

                // Extract addresses
                const addressLists = element.querySelectorAll('ul.flex.column-2 li, .address-list li');
                const addresses = [];
                addressLists.forEach(li => {
                    const addressText = li.textContent.trim();
                    if (addressText && addressText.length > 10 && addressText.match(/\d+/)) {
                        addresses.push({
                            address: addressText,
                            type: 'unknown'
                        });
                    }
                });
                if (addresses.length > 0) {
                    person.addresses = addresses;
                }

                // Extract aliases
                const aliasContainer = element.querySelector('#container-alt-names');
                if (aliasContainer) {
                    const aliasElements = aliasContainer.querySelectorAll('li');
                    const aliases = [];
                    aliasElements.forEach(el => {
                        aliases.push(el.textContent.trim());
                    });
                    if (aliases.length > 0) {
                        person.aliases = aliases;
                    }
                }

                // Extract details URL
                const detailsLink = element.querySelector('a[href*="/people/"]');
                if (detailsLink && (!person.name || detailsLink.textContent.trim().includes(person.name))) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name || person.phones || person.emails || person.addresses) {
                    people.push(person);
                }
            });

            return people;
        }

        extractPersonDetailsData() {
            const person = {
                type: 'detailed_record',
                status: 'found'
            };

            // Extract name from ZabaSearch structure
            const nameElement = document.querySelector('#container-name h2, h1');
            if (nameElement) {
                person.name = nameElement.textContent.replace(/^\d+\s+record found for /, '').trim();
            }

            // Extract age
            const ageElement = document.querySelector('.flex h3');
            if (ageElement && ageElement.previousElementSibling &&
                ageElement.previousElementSibling.textContent.includes('Age')) {
                person.age = ageElement.textContent.trim();
            }

            // Extract all sections with data
            const sections = document.querySelectorAll('.section-box');

            sections.forEach(section => {
                const heading = section.querySelector('h3, h4');
                if (!heading) return;

                const headingText = heading.textContent.toLowerCase();

                // Phone numbers
                if (headingText.includes('phone')) {
                    const phoneLinks = section.querySelectorAll('a[href*="/phone/"]');
                    const phones = [];
                    phoneLinks.forEach(link => {
                        phones.push({
                            number: link.textContent.trim(),
                            url: link.href,
                            type: headingText.includes('last known') ? 'last_known' : 'associated'
                        });
                    });
                    if (phones.length > 0) {
                        person.phones = phones;
                    }
                }

                // Email addresses
                if (headingText.includes('email')) {
                    const emailElements = section.querySelectorAll('li:not(:has(a))');
                    const emails = [];
                    emailElements.forEach(el => {
                        const emailText = el.textContent.trim();
                        if (emailText.includes('@')) {
                            emails.push(emailText);
                        }
                    });
                    if (emails.length > 0) {
                        person.emails = emails;
                    }
                }

                // Addresses
                if (headingText.includes('address')) {
                    const addressElements = section.querySelectorAll('p, li');
                    const addresses = [];
                    addressElements.forEach(el => {
                        const addressText = el.textContent.trim();
                        if (addressText.length > 10 && addressText.match(/\d+/)) {
                            addresses.push({
                                address: addressText,
                                type: headingText.includes('past') ? 'past' :
                                       headingText.includes('last known') ? 'current' : 'unknown'
                            });
                        }
                    });
                    if (addresses.length > 0) {
                        person.addresses = addresses;
                    }
                }

                // Relatives
                if (headingText.includes('relative')) {
                    const relativeLinks = section.querySelectorAll('a[href*="/people/"]');
                    const relatives = [];
                    relativeLinks.forEach(link => {
                        relatives.push({
                            name: link.textContent.trim(),
                            url: link.href
                        });
                    });
                    if (relatives.length > 0) {
                        person.relatives = relatives;
                    }
                }

                // Aliases
                if (headingText.includes('alias') || headingText.includes('aka')) {
                    const aliasElements = section.querySelectorAll('li');
                    const aliases = [];
                    aliasElements.forEach(el => {
                        aliases.push(el.textContent.trim());
                    });
                    if (aliases.length > 0) {
                        person.aliases = aliases;
                    }
                }
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        convertToText(data, scope) {
            let text = `ZABASEARCH EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Records Count: ${data.results.length}\n`;
            if (data.searchLocation) {
                const loc = data.searchLocation;
                if (loc.state && loc.cityOrCounty) {
                    text += `Search Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                } else if (loc.state) {
                    text += `Search Location: ${loc.state}\n`;
                }
            }
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RECORD ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.aliases && result.aliases.length > 0) {
                    text += `Aliases: ${result.aliases.join(', ')}\n`;
                }

                if (result.addresses && result.addresses.length > 0) {
                    text += `Addresses:\n`;
                    result.addresses.forEach(addr => {
                        text += `  - ${addr.address} (${addr.type || 'unknown'})\n`;
                    });
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones:\n`;
                    result.phones.forEach(phone => {
                        text += `  - ${phone.number}${phone.type ? ` (${phone.type})` : ''}\n`;
                    });
                }

                if (result.emails && result.emails.length > 0) {
                    text += `Emails: ${result.emails.join(', ')}\n`;
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join(', ')}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // Vote.org Extractor Class

// Vote.org Extractor Class
class VoteOrgExtractor extends BaseExtractor {
    constructor() {
        super();
        this.zipMapping = null;
        this.prefixToState = null;
        this.isLoading = false;
        this.loadPromise = null;
        this.ZIP_MAPPING_URL = 'https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/main/ZIP_MAPPINGS/zipMapping.js';
        this.CACHE_KEY = 'zipMappingCache_v3';
        this.CACHE_TIMESTAMP_KEY = 'zipMappingTimestamp_v3';
        this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    async init() {
        await this.waitForPageLoad();
        this.createUI();
        await this.loadZipMapping();
        this.setupZipAutoFill();
    }

    async loadZipMapping() {
        // Return cached mapping if available
        if (this.zipMapping) {
            console.log('VoteOrgExtractor: Using in-memory cache');
            return this.zipMapping;
        }

        // Check if another load is in progress
        if (this.isLoading && this.loadPromise) {
            console.log('VoteOrgExtractor: Waiting for existing load to complete');
            return this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = this._performLoad();
        
        try {
            const result = await this.loadPromise;
            return result;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    async _performLoad() {
        try {
            // Try to get from GM cache first
            const cachedData = this._getCachedMapping();
            if (cachedData) {
                console.log('VoteOrgExtractor: Using GM cache');
                this.zipMapping = cachedData.zipMapping;
                this.prefixToState = cachedData.prefixToState || this._getDefaultPrefixToState();
                return this.zipMapping;
            }

            // Download from GitHub
            console.log('VoteOrgExtractor: Downloading from GitHub...');
            const mappingData = await this._downloadZipMapping();
            
            // Parse the mapping from the JavaScript file
            const parsedData = this._parseZipMapping(mappingData);
            this.zipMapping = parsedData.zipMapping;
            this.prefixToState = parsedData.prefixToState || this._getDefaultPrefixToState();
            
            // Cache the parsed result
            this._cacheMapping({
                zipMapping: this.zipMapping,
                prefixToState: this.prefixToState
            });
            
            console.log(`VoteOrgExtractor: Successfully loaded ${Object.keys(this.zipMapping).length} ZIP mappings`);
            return this.zipMapping;

        } catch (error) {
            console.error('VoteOrgExtractor: Failed to load mapping:', error);
            this.zipMapping = this._getDefaultFallbackMapping();
            this.prefixToState = this._getDefaultPrefixToState();
            return this.zipMapping;
        }
    }

    async _downloadZipMapping() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: this.ZIP_MAPPING_URL,
                timeout: 30000,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Network error: ${error}`));
                },
                ontimeout: function() {
                    reject(new Error('Request timeout after 30s'));
                }
            });
        });
    }

    _parseZipMapping(jsContent) {
        try {
            const result = {
                zipMapping: {},
                prefixToState: {}
            };

            // Extract zipMapping object
            const zipMappingMatch = jsContent.match(/const zipMapping = \{([\s\S]*?)\};/);
            if (zipMappingMatch) {
                const mappingString = '{' + zipMappingMatch[1] + '}';
                const jsonString = this._cleanJsonString(mappingString);
                result.zipMapping = JSON.parse(jsonString);
            }

            // Extract prefixToState object
            const prefixMatch = jsContent.match(/const prefixToState = \{([\s\S]*?)\};/);
            if (prefixMatch) {
                const prefixString = '{' + prefixMatch[1] + '}';
                const prefixJson = this._cleanJsonString(prefixString);
                result.prefixToState = JSON.parse(prefixJson);
            }

            return result;
        } catch (error) {
            console.error('VoteOrgExtractor: Error parsing mapping:', error);
            return {
                zipMapping: this._getDefaultFallbackMapping(),
                prefixToState: this._getDefaultPrefixToState()
            };
        }
    }

    _cleanJsonString(str) {
        return str
            .replace(/(\w+):/g, '"$1":')           // Add quotes to keys
            .replace(/'/g, '"')                     // Replace single quotes
            .replace(/,\s*}/g, '}')                 // Remove trailing commas
            .replace(/,\s*]/g, ']')                 // Remove trailing commas in arrays
            .replace(/\s*\/\/.*$/gm, '')            // Remove inline comments
            .replace(/\/\*[\s\S]*?\*\//g, '');      // Remove block comments
    }

    _getCachedMapping() {
        try {
            const cachedData = GM_getValue(this.CACHE_KEY);
            const timestamp = GM_getValue(this.CACHE_TIMESTAMP_KEY);
            
            if (!cachedData || !timestamp) {
                console.log('VoteOrgExtractor: No cache found');
                return null;
            }

            const now = Date.now();
            const cacheAge = now - timestamp;

            if (cacheAge > this.CACHE_DURATION) {
                console.log('VoteOrgExtractor: Cache expired, age:', Math.round(cacheAge / (24 * 60 * 60 * 1000)), 'days');
                this._clearCache();
                return null;
            }

            console.log('VoteOrgExtractor: Using cache, age:', Math.round(cacheAge / (60 * 60 * 1000)), 'hours');
            return cachedData;

        } catch (error) {
            console.error('VoteOrgExtractor: Error reading cache:', error);
            return null;
        }
    }

    _cacheMapping(data) {
        try {
            GM_setValue(this.CACHE_KEY, data);
            GM_setValue(this.CACHE_TIMESTAMP_KEY, Date.now());
            console.log('VoteOrgExtractor: Cache updated');
        } catch (error) {
            console.error('VoteOrgExtractor: Error caching:', error);
        }
    }

    _clearCache() {
        try {
            GM_deleteValue(this.CACHE_KEY);
            GM_deleteValue(this.CACHE_TIMESTAMP_KEY);
            console.log('VoteOrgExtractor: Cache cleared');
        } catch (error) {
            console.error('VoteOrgExtractor: Error clearing cache:', error);
        }
    }

    _getDefaultFallbackMapping() {
        return {
            '10001': { city: 'New York', state: 'NY', county: 'New York County' },
            '90210': { city: 'Beverly Hills', state: 'CA', county: 'Los Angeles County' },
            '33101': { city: 'Miami', state: 'FL', county: 'Miami-Dade County' },
            '60601': { city: 'Chicago', state: 'IL', county: 'Cook County' },
            '75201': { city: 'Dallas', state: 'TX', county: 'Dallas County' }
        };
    }

    _getDefaultPrefixToState() {
        return {
            '100': 'NY', '200': 'DC', '300': 'GA', '400': 'KY', '500': 'IA',
            '600': 'IL', '700': 'LA', '800': 'CO', '900': 'HI', '010': 'MA',
            '020': 'MA', '030': 'NH', '040': 'ME', '050': 'VT', '060': 'CT',
            '070': 'NJ', '080': 'NJ', '090': 'CT', '320': 'FL', '330': 'FL',
            '331': 'FL', '334': 'FL', '336': 'FL', '339': 'FL', '342': 'FL',
            '346': 'FL', '347': 'FL', '349': 'FL', '350': 'AL', '352': 'AL',
            '354': 'AL', '358': 'AL', '360': 'AL', '361': 'AL', '363': 'AL',
            '365': 'AL', '366': 'AL', '370': 'TN', '371': 'TN', '372': 'TN',
            '373': 'TN', '374': 'TN', '376': 'TN', '377': 'TN', '378': 'TN',
            '379': 'TN', '380': 'TN', '381': 'TN', '382': 'TN', '383': 'TN',
            '384': 'TN', '385': 'TN', '386': 'MS', '387': 'MS', '388': 'MS',
            '389': 'MS', '390': 'MS', '391': 'MS', '392': 'MS', '393': 'MS',
            '394': 'MS', '395': 'MS', '396': 'MS', '397': 'MS', '398': 'GA',
            '399': 'GA', '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN',
            '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN',
            '469': 'IN', '470': 'IN', '471': 'IN', '472': 'IN', '473': 'IN',
            '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN',
            '479': 'IN', '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI',
            '484': 'MI', '485': 'MI', '486': 'MI', '487': 'MI', '488': 'MI',
            '489': 'MI', '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI',
            '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI',
            '499': 'MI'
        };
    }

    getStateFromZipPrefix(zipCode) {
        if (!zipCode || zipCode.length < 3) return null;
        
        const prefix = zipCode.substring(0, 3);
        
        // Ensure prefixToState is loaded
        if (!this.prefixToState) {
            this.prefixToState = this._getDefaultPrefixToState();
        }
        
        return this.prefixToState[prefix] || null;
    }

    async refreshMapping() {
        console.log('VoteOrgExtractor: Force refreshing...');
        this._clearCache();
        this.zipMapping = null;
        this.prefixToState = null;
        return this.loadZipMapping();
    }

    getStats() {
        if (!this.zipMapping) {
            return { count: 0, source: 'none', cached: false };
        }
        
        const isFallback = this.zipMapping === this._getDefaultFallbackMapping();
        return {
            count: Object.keys(this.zipMapping).length,
            prefixCount: this.prefixToState ? Object.keys(this.prefixToState).length : 0,
            source: isFallback ? 'fallback' : 'github',
            cached: this._getCachedMapping() !== null
        };
    }

    // The rest of your methods remain the same...
    autoFillFromZip(zipCode) {
        if (!this.zipMapping) {
            this.loadZipMapping();
        }

        const locationData = this.zipMapping[zipCode];

        if (locationData) {
            console.log(`Found location data for ZIP ${zipCode}:`, locationData);

            // Fill city field
            const cityInput = document.querySelector('input[name="city"], input[name*="city"], input[id*="city"]');
            if (cityInput && locationData.city) {
                cityInput.value = locationData.city;
                console.log(`Auto-filled city: ${locationData.city}`);
            }

            // Fill state field - handle both select and input fields
            const stateSelect = document.querySelector('select[name*="state"], select[name="state_abbr"], select[id*="state"]');
            const stateInput = document.querySelector('input[name*="state"], input[id*="state"]');

            if (stateSelect && locationData.state) {
                const option = Array.from(stateSelect.options).find(opt =>
                    opt.value.toUpperCase() === locationData.state.toUpperCase() ||
                    opt.textContent.toUpperCase().includes(locationData.state.toUpperCase())
                );
                if (option) {
                    stateSelect.value = option.value;
                    console.log(`Auto-filled state (select): ${locationData.state}`);
                }
            } else if (stateInput && locationData.state) {
                stateInput.value = locationData.state;
                console.log(`Auto-filled state (input): ${locationData.state}`);
            }

            // Fill county field if it exists
            const countyInput = document.querySelector('input[name*="county"], select[name*="county"], input[id*="county"]');
            if (countyInput && locationData.county) {
                countyInput.value = locationData.county;
                console.log(`Auto-filled county: ${locationData.county}`);
            }

            return true;
        } else {
            console.log(`No mapping found for ZIP: ${zipCode}`);

            // Fallback: Try to get state from ZIP prefix
            const state = this.getStateFromZipPrefix(zipCode);
            if (state) {
                console.log(`Using state from prefix: ${state}`);
                const stateSelect = document.querySelector('select[name*="state"], select[name="state_abbr"]');
                const stateInput = document.querySelector('input[name*="state"]');

                if (stateSelect) {
                    const option = Array.from(stateSelect.options).find(opt =>
                        opt.value.toUpperCase() === state.toUpperCase()
                    );
                    if (option) {
                        stateSelect.value = option.value;
                        console.log(`Auto-filled state from prefix: ${state}`);
                    }
                } else if (stateInput) {
                    stateInput.value = state;
                    console.log(`Auto-filled state from prefix: ${state}`);
                }
            }

            return false;
        }
    }

    setupZipAutoFill() {
        // Listen for ZIP code input changes on ANY input field
        document.addEventListener('input', (e) => {
            const target = e.target;
            // Match any input that looks like it could be a ZIP code
            if (target.matches('input[type="text"], input[type="tel"]') &&
                (target.name && (target.name.includes('zip') || target.name.includes('postal')) ||
                 target.id && (target.id.includes('zip') || target.id.includes('postal')) ||
                 target.placeholder && target.placeholder.toLowerCase().includes('zip'))) {

                const zipCode = target.value.trim();
                if (zipCode.length === 5 && /^\d+$/.test(zipCode)) {
                    console.log(`ZIP code detected: ${zipCode}`);
                    setTimeout(() => this.autoFillFromZip(zipCode), 100);
                }
            }
        });

        // Also try to auto-fill on page load if ZIP is already present
        setTimeout(() => {
            const zipInputs = document.querySelectorAll('input[name*="zip"], input[name*="postal"], input[id*="zip"], input[placeholder*="zip"]');
            zipInputs.forEach(input => {
                const zipCode = input.value.trim();
                if (zipCode.length === 5 && /^\d+$/.test(zipCode)) {
                    console.log(`Auto-filling existing ZIP: ${zipCode}`);
                    this.autoFillFromZip(zipCode);
                }
            });
        }, 1500);
    }

    // Optional: Add this method to manually trigger auto-fill if needed
    triggerZipAutoFill() {
        const zipInput = document.querySelector('input[name*="zip"], input[name*="postal"], input[name="zip_5"]');
        if (zipInput) {
            const zipCode = zipInput.value.trim();
            if (zipCode.length === 5) {
                return this.autoFillFromZip(zipCode);
            }
        }
        return false;
    }

    // ... rest of your existing methods (extractData, autofillForm, etc.) ...
    extractData() {
        const data = super.extractData();

        // Check for registered voter page FIRST (most specific)
        if (this.isRegisteredVoterPage()) {
            data.results = this.extractVoterRegistrationData();
            data.pageType = 'voter_registration_results';
        }
        // Check for no registration found
        else if (this.isNoRegistrationPage()) {
            data.results = this.extractNoRegistrationData();
            data.pageType = 'no_registration';
        }
        // Check if this is the search form page
        else if (this.isSearchFormPage()) {
            data.results = [{ status: 'search_form', message: 'Voter registration search form' }];
            data.pageType = 'search_form';
        }
        // Fallback: check page content for registration status
        else {
            data.results = this.extractFromPageContent();
            if (data.results.length > 0) {
                data.pageType = data.results[0].isRegistered ? 'voter_registration_results' : 'no_registration';
            }
        }

        return data;
    }

    autofillForm(data = null) {
        const form = document.querySelector('form#verification_form');

        // Use provided data or generate sample data
        const fillData = data;

        let filledFields = 0;

        // Fill first name
        const firstNameInput = form.querySelector('input[name="first_name"]');
        if (firstNameInput && fillData.firstName) {
            firstNameInput.value = fillData.firstName;
            filledFields++;
        }

        // Fill last name
        const lastNameInput = form.querySelector('input[name="last_name"]');
        if (lastNameInput && fillData.lastName) {
            lastNameInput.value = fillData.lastName;
            filledFields++;
        }

        // Fill street address
        const streetInput = form.querySelector('input[name="street_address"]');
        if (streetInput && fillData.streetAddress) {
            streetInput.value = fillData.streetAddress;
            filledFields++;
        }

        // Fill city
        const cityInput = form.querySelector('input[name="city"]');
        if (cityInput && fillData.city) {
            cityInput.value = fillData.city;
            filledFields++;
        }

        // Fill state (dropdown)
        const stateSelect = form.querySelector('select[name="state_abbr"]');
        if (stateSelect && fillData.state) {
            const option = Array.from(stateSelect.options).find(opt =>
                opt.value.toUpperCase() === fillData.state.toUpperCase()
            );
            if (option) {
                stateSelect.value = option.value;
                filledFields++;
            }
        }

        // Fill ZIP code
        const zipInput = form.querySelector('input[name="zip_5"]');
        if (zipInput && fillData.zipCode) {
            zipInput.value = fillData.zipCode;
            filledFields++;

            // Trigger auto-fill for any additional fields
            setTimeout(() => this.autoFillFromZip(fillData.zipCode), 100);
        }

        // Fill email (hidden - use default)
        const emailInput = form.querySelector('input[name="email"]');
        if (emailInput) {
            emailInput.value = 'tahis60368@haotuwu.com';
            filledFields++;
        }

        // Fill date of birth (01/01/ with user year)
        const dobMonth = form.querySelector('select[name="date_of_birth_month"]');
        const dobDay = form.querySelector('select[name="date_of_birth_day"]');
        const dobYear = form.querySelector('select[name="date_of_birth_year"]');
        if (dobMonth && dobDay && dobYear) {
            // Always set to 01/01/
            dobMonth.value = '1';
            dobDay.value = '1';

            // Use provided year or current year - 30 as default
            if (fillData.dobYear) {
                dobYear.value = fillData.dobYear;
            } else {
                const currentYear = new Date().getFullYear();
                dobYear.value = (currentYear - 30).toString();
            }
            filledFields += 3;
        }

        // Fill phone number (optional)
        const phoneInput = form.querySelector('input[name="phone_number"]');
        if (phoneInput && fillData.phone) {
            phoneInput.value = fillData.phone;
            filledFields++;
        }

        // Check the terms agreement checkbox
        const termsCheckbox = form.querySelector('input[name="agreed_to_terms"]');
        if (termsCheckbox) {
            termsCheckbox.checked = true;
            filledFields++;
        }

        console.log(`Universal Exporter: Autofilled ${filledFields} form fields`);
        return filledFields > 0;
    }
}

    // Generic Extractor for fallback
class GenericExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Try to extract any person-like data
            const potentialPeople = document.querySelectorAll('[class*="person"], [class*="result"], [class*="card"]');
            if (potentialPeople.length > 0) {
                data.results = this.extractGenericData(potentialPeople);
                data.pageType = 'generic_results';
            }

            return data;
        }

        extractGenericData(elements) {
            const people = [];

            elements.forEach((element, index) => {
                const person = {
                    type: 'generic_result',
                    status: 'found',
                    id: element.id || `generic_${index}`,
                    rawText: element.textContent.trim().substring(0, 200) + '...'
                };

                // Try to find name-like text (usually in headings)
                const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b');
                headings.forEach(heading => {
                    const text = heading.textContent.trim();
                    if (text && text.length > 2 && text.length < 50 && !person.name) {
                        person.name = text;
                    }
                });

                if (person.name || person.rawText.length > 50) {
                    people.push(person);
                }
            });

            return people;
        }
    }

    // Main Universal Exporter Class
    class UniversalBackgroundCheckExporter {
        constructor() {
            this.site = this.detectSite();
            this.isMobile = this.detectMobile();
            this.currentPageData = null;
            this.siteExtractor = null;
            this.init();
        }

    setupZipAutoFillForVoteSection() {
        const zipInput = document.getElementById('ubcVoteZip');
        if (!zipInput) return;

        // Create an instance of VoteOrgExtractor to use its ZIP mapping functionality
        const voteExtractor = new VoteOrgExtractor();
        voteExtractor.loadZipMapping();

        zipInput.addEventListener('input', (e) => {
            const zipCode = e.target.value.trim();

            // Only process when we have a valid 5-digit ZIP code
            if (zipCode.length === 5 && /^\d+$/.test(zipCode)) {
                console.log(`Detected ZIP code in vote section: ${zipCode}`);

                // Use the existing ZIP mapping functionality
                const locationData = voteExtractor.zipMapping[zipCode];

                if (locationData) {
                    console.log(`Found location data for ZIP ${zipCode}:`, locationData);

                    // Fill city field
                    const cityInput = document.getElementById('ubcVoteCity');
                    if (cityInput && locationData.city) {
                        cityInput.value = locationData.city;
                        console.log(`Auto-filled city: ${locationData.city}`);
                    }

                    // Fill state field
                    const stateInput = document.getElementById('ubcVoteState');
                    if (stateInput && locationData.state) {
                        stateInput.value = locationData.state;
                        console.log(`Auto-filled state: ${locationData.state}`);
                    }
                } else {
                    console.log(`No mapping found for ZIP: ${zipCode}`);

                    // Fallback: Try to get state from ZIP prefix
                    const state = voteExtractor.getStateFromZipPrefix(zipCode);
                    if (state) {
                        console.log(`Using state from prefix: ${state}`);
                        const stateInput = document.getElementById('ubcVoteState');
                        if (stateInput) {
                            stateInput.value = state;
                            console.log(`Auto-filled state from prefix: ${state}`);
                        }
                    }
                }
            }
        });

        // Also try to auto-fill on page load if ZIP is already present
        setTimeout(() => {
            const existingZip = zipInput.value.trim();
            if (existingZip.length === 5 && /^\d+$/.test(existingZip)) {
                console.log(`Auto-filling existing ZIP in vote section: ${existingZip}`);
                const locationData = voteExtractor.zipMapping[existingZip];

                if (locationData) {
                    const cityInput = document.getElementById('ubcVoteCity');
                    const stateInput = document.getElementById('ubcVoteState');

                    if (cityInput && locationData.city) cityInput.value = locationData.city;
                    if (stateInput && locationData.state) stateInput.value = locationData.state;
                }
            }
        }, 500);
    }

        async init() {
            await this.waitForPageLoad();
            this.initializeSiteExtractor();
            this.extractCurrentPageData();
            this.createUI();
        }

        async waitForPageLoad() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
        }

        showStreetView() {
            if (!this.currentCoords) {
                const resultsDiv = document.getElementById('ubcMapsResults');
                resultsDiv.innerHTML = '<div style="color: #e74c3c;">Please geocode an address first</div>';
                return;
            }

            const streetViewUrl = MapsUtility.generateStreetViewUrl(this.currentCoords.lat, this.currentCoords.lng);
            window.open(streetViewUrl, '_blank');
        }



        initializeSiteExtractor() {
            switch (this.site) {
                case 'fastbackgroundcheck':
                    this.siteExtractor = new FastBackgroundCheckExtractor();
                    break;
                case 'fastpeoplesearch':
                    this.siteExtractor = new FastPeopleSearchExtractor();
                    break;
                case 'zabasearch':
                    this.siteExtractor = new ZabaSearchExtractor();
                    break;
                case 'vote.org':
                    this.siteExtractor = new VoteOrgExtractor();
                    break;
                default:
                    this.siteExtractor = new GenericExtractor();
            }
        }

        detectSite() {
            const url = window.location.href;
            if (url.includes('fastbackgroundcheck.com')) return 'fastbackgroundcheck';
            if (url.includes('fastpeoplesearch.com')) return 'fastpeoplesearch';
            if (url.includes('zabasearch.com')) return 'zabasearch';
            // if (url.includes('whitepages.com')) return 'whitepages';
            if (url.includes('verify.vote.org') || url.includes('vote.org')) return 'vote.org';
            return 'unknown';
        }

        detectMobile() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        extractCurrentPageData() {
            this.currentPageData = this.siteExtractor.extractData();
            return this.currentPageData;
        }


createUI() {
    // Remove existing UI if present
    const existingUI = document.getElementById('ubc-exporter-ui');
    if (existingUI) {
        existingUI.remove();
    }

    // Create main container
    const container = document.createElement('div');
    container.id = 'ubc-exporter-ui';

    if (this.isMobile) {
        container.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-height: 80vh;
            overflow-y: auto;
        `;
    } else {
        container.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 500px;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-height: 80vh;
            overflow-y: auto;
        `;
    }

    // Header with site info and branding
    const header = document.createElement('div');
    header.style.cssText = 'border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px;';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    const title = document.createElement('h3');
    const siteNames = {
        'fastbackgroundcheck': 'FastBackgroundCheck',
        'fastpeoplesearch': 'FastPeopleSearch',
        'zabasearch': 'ZabaSearch',
        // 'whitepages': 'Whitepages',
        'vote.org': 'Vote.org'
    };
    title.textContent = `Universal Exporter v2.2.0 - ${siteNames[this.site] || this.site}`;
    title.style.cssText = 'margin: 0; margin-left: 100px; color: #2c3e50; font-size: 16px;';
    titleRow.appendChild(title);
    header.appendChild(titleRow);


    // Age Calculator Section
    const ageCalculatorSection = document.createElement('div');
    ageCalculatorSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #e8f6f3; border-radius: 4px; border: 1px solid #a3e4d7;';
    ageCalculatorSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #148f77;">🧮 Age Calculator:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcAgeDate" placeholder="Birth Date (MM/DD/YYYY)" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcAgeYear" placeholder="Or Birth Year (YYYY)" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcAgeNumber" placeholder="Or Current Age" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <select id="ubcAgeReference" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
                <option value="current">Current Year</option>
                <option value="2024">Year 2024</option>
                <option value="2023">Year 2023</option>
                <option value="2022">Year 2022</option>
            </select>
        </div>
        <button id="ubcCalculateAge" style="background: #148f77; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Calculate Age/Birth Year</button>
        <div id="ubcAgeResults" style="margin-top: 10px; font-size: 11px; display: none;"></div>
    `;

    // Quick navigation links
    const navLinks = document.createElement('div');
    navLinks.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; margin-left: 50px; font-size: 11px;';
    navLinks.innerHTML = `
        <a href="https://www.fastbackgroundcheck.com" target="_blank" style="color: #3498db; text-decoration: none; padding: 3px 6px; border: 1px solid #3498db; border-radius: 3px;">FastBackgroundCheck</a>
        <a href="https://www.fastpeoplesearch.com" target="_blank" style="color: #27ae60; text-decoration: none; padding: 3px 6px; border: 1px solid #27ae60; border-radius: 3px;">FastPeopleSearch</a>
        <a href="https://www.zabasearch.com" target="_blank" style="color: #f39c12; text-decoration: none; padding: 3px 6px; border: 1px solid #f39c12; border-radius: 3px;">ZabaSearch</a>
        <a href="https://www.whitepages.com" target="_blank" style="color: #879ced; text-decoration: none; padding: 3px 6px; border: 1px solid #879ced; border-radius: 3px;">Whitepages</a>
        <a href="https://verify.vote.org/" target="_blank" style="color: #9b59b6; text-decoration: none; padding: 3px 6px; border: 1px solid #9b59b6; border-radius: 3px;">Vote.org</a>
    `;
    header.appendChild(navLinks);

    // Search Section
    const searchSection = document.createElement('div');
    searchSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef;';
    searchSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #2c3e50;">Quick Search:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcSearchFirstName" placeholder="First Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcSearchLastName" placeholder="Last Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcSearchCity" placeholder="City (optional)" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcSearchState" placeholder="State *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px;">
            * Required fields. State is required for all searches.
        </div>
        <button id="ubcGenerateSearch" style="background: #9b59b6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Generate Search Links</button>
        <div id="ubcSearchResults" style="margin-top: 10px; font-size: 11px; display: none;"></div>
    `;

    // Vote.org API Section
    const voteOrgSection = document.createElement('div');
    voteOrgSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f0e6ff; border-radius: 4px; border: 1px solid #d9c2ff;';
    voteOrgSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #6b46c1;">Vote.org API Check:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteFirstName" placeholder="First Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteLastName" placeholder="Last Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteStreet" placeholder="Street Address *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; width: auto;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteCity" placeholder="City *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteState" placeholder="State *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteZip" placeholder="ZIP Code *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteYear" placeholder="Birth Year (YYYY) *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px;">
            * Required fields. Date of birth will be set to 01/01/YYYY automatically. see why <a href="https://github.com/airborne-commando/tampermonkey-collection?tab=readme-ov-file#voter-extraction-lite" target="_blank" style="color: #9b59b6">here</a>.
        </div>
        <button id="ubcCheckVoter" style="background: #6b46c1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Check Voter Status via API</button>
        <div id="ubcVoteResults" style="margin-top: 10px; font-size: 11px; display: none;"></div>
    `;

    // Current page info
    const pageInfo = document.createElement('div');
    pageInfo.style.cssText = 'margin-bottom: 10px; padding: 8px; background: #e8f4fd; border-radius: 4px; font-size: 12px;';

    const pageType = this.currentPageData.pageType === 'search_results' ? 'Search Results' :
                   this.currentPageData.pageType === 'person_details' ? 'Person Details' :
                   this.currentPageData.pageType === 'people_list' ? 'People List' :
                   this.currentPageData.pageType === 'voter_registration_results' ? 'Voter Registration' :
                   this.currentPageData.pageType === 'no_registration' ? 'No Registration' :
                   this.currentPageData.pageType === 'search_form' ? 'Search Form' : 'No Results';

    let locationInfo = '';
    if (this.currentPageData.searchLocation) {
        const loc = this.currentPageData.searchLocation;
        if (loc.state && loc.cityOrCounty) {
            locationInfo = `<br><strong>Location:</strong> ${loc.cityOrCounty}, ${loc.state}`;
        } else if (loc.state) {
            locationInfo = `<br><strong>Location:</strong> ${loc.state}`;
        }
    }

    pageInfo.innerHTML = `
        <strong>Site:</strong> ${siteNames[this.site] || this.site}<br>
        <strong>Page Type:</strong> ${pageType}<br>
        <strong>Records Found:</strong> ${this.currentPageData.results.length}${locationInfo}<br>
        <small>${window.location.href}</small>
    `;

    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = this.isMobile ?
        'margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;' :
        'margin: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;';

    actionButtons.innerHTML = this.isMobile ? `
        <button id="ubcSavePageBtn" style="background: #3498db; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; grid-column: 1 / -1;">Save Current Page</button>
        <button id="ubcExportBtn" style="background: #27ae60; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Export Data</button>
        <button id="ubcViewSavedBtn" style="background: #f39c12; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">View Saved</button>
<!--        <button id="ubcAutofillBtn" style="background: #9b59b6; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Autofill Form</button> -->
<!-- <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Import Data</button> -->
        <button id="ubcClearBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Clear Data</button>
    ` : `
        <button id="ubcSavePageBtn" style="background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Save Page</button>
        <button id="ubcExportBtn" style="background: #27ae60; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Export</button>
        <button id="ubcViewSavedBtn" style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">View Saved</button>
<!--         <button id="ubcAutofillBtn" style="background: #9b59b6; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Autofill</button> -->
<!--         <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Import</button> -->
        <button id="ubcClearBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Clear</button>
    `;

// Add later, wil have to figure this one out...

        // <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Import Data</button>
        // <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Import</button>

    // Quick Maps Section
    const quickMapsSection = document.createElement('div');
    quickMapsSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;';
    quickMapsSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #856404;">🗺️ Quick Maps:</div>
        <div style="margin-bottom: 8px;">
            <input type="text" id="ubcQuickMaps" placeholder="Enter address for maps..."
                   style="width: 70%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; margin-bottom: 8px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button id="ubcGoogleMapsBtn" style="background: #4285f4; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    Google Maps
                </button>
                <button id="ubcBingMapsBtn" style="background: #008373; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    Bing Maps
                </button>
                <button id="ubcOpenstreetMapsBtn" style="background: #7ebc6f; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                OpenStreetMap
            </button>
                <button id="ubcOpenEarth" style="background: #4285f4; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Google Earth
            </button>
            </div>
        </div>
        <div style="font-size: 10px; color: #666;">
            Quick address lookup on all mapping platforms
        </div>
`;

    // Export options
    const optionsDiv = document.createElement('div');
    optionsDiv.style.cssText = 'margin: 10px 0;';
    optionsDiv.innerHTML = `
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Export Format:</label>
        <select id="ubcExportFormat" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="json">JSON</option>
            <option value="txt">Text</option>
        </select>
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Data Scope:</label>
        <select id="ubcDataScope" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="current">Current Page Only</option>
            <option value="all">All Saved Pages</option>
            <option value="site_all">All ${siteNames[this.site] || this.site} Pages</option>
        </select>
    `;

    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.id = 'ubcExporterStatus';
    statusDiv.style.cssText = 'margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px;';
    statusDiv.innerHTML = '<strong>Status:</strong> Ready';

    // Preview area
    const previewDiv = document.createElement('div');
    previewDiv.id = 'ubcResultsPreview';
    previewDiv.style.cssText = `margin-top: 10px; border: 1px solid #ddd; padding: 10px; height: ${this.isMobile ? '150px' : '200px'}; overflow-y: auto; font-size: 11px; background: #f9f9f9; border-radius: 4px;`;
    previewDiv.innerHTML = '<div>Preview will appear here...</div>';

    // Footer with additional links
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 10px; color: #666; text-align: center;';
    footer.innerHTML = `
        <div style="margin-bottom: 5px;">
            <strong>Quick Navigation:</strong>
            <a href="https://www.fastbackgroundcheck.com" target="_blank" style="color: #3498db; margin: 0 5px;">FBC</a> •
            <a href="https://www.fastpeoplesearch.com" target="_blank" style="color: #27ae60; margin: 0 5px;">FPS</a> •
            <a href="https://www.zabasearch.com" target="_blank" style="color: #f39c12; margin: 0 5px;">Zaba</a> •
            <a href="https://www.whitepages.com" target="_blank" style="color: #879ced; margin: 0 5px;">Whitepages</a> •
            <a href="https://verify.vote.org/" target="_blank" style="color: #9b59b6; margin: 0 5px;">Vote</a>
        </div>
    `;

    // Assemble UI
    container.appendChild(header);
    container.appendChild(searchSection);
    container.appendChild(voteOrgSection);
    container.appendChild(pageInfo);
    container.appendChild(actionButtons);
    container.appendChild(quickMapsSection);
    container.appendChild(optionsDiv);
    container.appendChild(statusDiv);
    container.appendChild(previewDiv);
    container.appendChild(ageCalculatorSection);
    container.appendChild(footer);

    document.body.appendChild(container);

    // Event listeners - ADD THEM AFTER ALL ELEMENTS ARE CREATED
    document.getElementById('ubcCalculateAge').onclick = () => this.calculateAge();
    document.getElementById('ubcSavePageBtn').onclick = () => this.saveCurrentPage();
    document.getElementById('ubcExportBtn').onclick = () => this.exportData();
    document.getElementById('ubcViewSavedBtn').onclick = () => this.viewSavedPages();
    document.getElementById('ubcClearBtn').onclick = () => this.clearAllData();
    document.getElementById('ubcGenerateSearch').onclick = () => this.generateSearchLinks();
    document.getElementById('ubcCheckVoter').onclick = () => this.checkVoterStatus();
    document.getElementById('ubcExportFormat').addEventListener('change', () => this.updatePreview());
    document.getElementById('ubcDataScope').addEventListener('change', () => this.updatePreview());
    // document.getElementById('ubcAutofillBtn').onclick = () => this.autofillForm();
    // Future function
    // document.getElementById('ubcImportBtn').onclick = () => this.importSearchData();

    // Add ZIP code auto-fill for vote.org section
    this.setupZipAutoFillForVoteSection();

    // Add event listener for quick maps
    document.getElementById('ubcGoogleMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            window.open(mapsUrl, '_blank');
        }
    };

    document.getElementById('ubcBingMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const bingUrl = `https://www.bing.com/maps?q=${encodeURIComponent(address)}`;
            window.open(bingUrl, '_blank');
        }
    };

    document.getElementById('ubcOpenstreetMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const SteetURL = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
            window.open(SteetURL, '_blank');
        }
    };

    document.getElementById('ubcOpenEarth').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const EarthURL = `https://earth.google.com/web/search/${encodeURIComponent(address)}`;
            window.open(EarthURL, '_blank');
        }
    };

    // Add event listeners for advanced maps AFTER the section is added to DOM
    setTimeout(() => {
        const geocodeBtn = document.getElementById('ubcGeocodeBtn');
        const streetViewBtn = document.getElementById('ubcStreetViewBtn');
        const mapsAddressInput = document.getElementById('ubcMapsAddress');

        if (geocodeBtn) {
            geocodeBtn.onclick = () => this.showMapForAddress();
        }
        if (streetViewBtn) {
            streetViewBtn.onclick = () => this.showStreetView();
        }
        if (mapsAddressInput) {
            mapsAddressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.showMapForAddress();
                }
            });
        }
    }, 100);

    this.log(`Universal exporter initialized for ${siteNames[this.site]}`);
    this.updatePreview();
}


        async checkVoterStatus() {
            const firstName = document.getElementById('ubcVoteFirstName').value.trim();
            const lastName = document.getElementById('ubcVoteLastName').value.trim();
            const streetAddress = document.getElementById('ubcVoteStreet').value.trim();
            const city = document.getElementById('ubcVoteCity').value.trim();
            const state = document.getElementById('ubcVoteState').value.trim();
            const zipCode = document.getElementById('ubcVoteZip').value.trim();
            const dobYear = document.getElementById('ubcVoteYear').value.trim();

            // Validate inputs
            if (!firstName || !lastName || !streetAddress || !zipCode || !dobYear) {
                this.log('Please fill all required fields for voter check');
                return;
            }

            if (!dobYear.match(/^\d{4}$/) || parseInt(dobYear) < 1900 || parseInt(dobYear) > new Date().getFullYear()) {
                this.log('Please enter a valid 4-digit birth year');
                return;
            }

            this.log('Checking voter registration status via API...');

            const voterData = {
                firstName,
                lastName,
                streetAddress,
                city,
                state,
                zipCode,
                dobYear
            };

            try {
                const result = await VoteOrgAPI.checkVoterStatus(voterData);

                if (result.success) {
                    const voterInfo = VoteOrgAPI.parseVoterResponse(result.responseText);

                    // Display results
                    const resultsDiv = document.getElementById('ubcVoteResults');
                    let html = '<div style="font-weight: bold; margin-bottom: 5px;">Voter Registration Results:</div>';

                    if (voterInfo.isRegistered) {
                        html += `<div style="color: #27ae60; font-weight: bold;">✓ REGISTERED TO VOTE</div>`;
                    } else {
                        html += `<div style="color: #e74c3c; font-weight: bold;">✗ NOT REGISTERED</div>`;
                    }

                    if (voterInfo.fullName) {
                        html += `<div><strong>Name:</strong> ${voterInfo.fullName}</div>`;
                    }

                    if (voterInfo.registrationAddress) {
                        html += `<div><strong>Address:</strong> ${voterInfo.registrationAddress}</div>`;
                    }

                    html += `<div><strong>Status:</strong> ${voterInfo.registrationStatus}</div>`;
                    html += `<div style="margin-top: 8px; font-size: 10px; color: #666;">API request successful</div>`;

                    resultsDiv.innerHTML = html;
                    resultsDiv.style.display = 'block';

                    this.log(`Voter check completed: ${voterInfo.registrationStatus}`);

                    // Save the result
                    this.saveVoterResult(voterInfo, voterData);

                } else {
                    this.log(`API request failed: ${result.error}`);
                    const resultsDiv = document.getElementById('ubcVoteResults');
                    resultsDiv.innerHTML = `<div style="color: #e74c3c;">API request failed: ${result.error}</div>`;
                    resultsDiv.style.display = 'block';
                }
            } catch (error) {
                this.log(`Error checking voter status: ${error}`);
                const resultsDiv = document.getElementById('ubcVoteResults');
                resultsDiv.innerHTML = `<div style="color: #e74c3c;">Error: ${error.message}</div>`;
                resultsDiv.style.display = 'block';
            }
        }

calculateAge() {
    const dateInput = document.getElementById('ubcAgeDate').value.trim();
    const yearInput = document.getElementById('ubcAgeYear').value.trim();
    const ageInput = document.getElementById('ubcAgeNumber').value.trim();
    const referenceYear = document.getElementById('ubcAgeReference').value;
    const resultsDiv = document.getElementById('ubcAgeResults');

    let result;

    if (dateInput) {
        // Try to parse the date string
        const parsedDate = AgeCalculator.parseDateString(dateInput);
        if (parsedDate) {
            result = AgeCalculator.calculateAge(parsedDate);
        } else {
            // Try direct date parsing
            const directDate = new Date(dateInput);
            if (!isNaN(directDate.getTime())) {
                result = AgeCalculator.calculateAge(directDate);
            } else {
                resultsDiv.innerHTML = `<div style="color: #e74c3c;">Invalid date format. Try MM/DD/YYYY or YYYY-MM-DD</div>`;
                resultsDiv.style.display = 'block';
                return;
            }
        }
    } else if (yearInput) {
        const birthYear = parseInt(yearInput);
        if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= new Date().getFullYear()) {
            result = AgeCalculator.calculateAgeFromYear(birthYear);
        } else {
            resultsDiv.innerHTML = `<div style="color: #e74c3c;">Please enter a valid birth year (1900-${new Date().getFullYear()})</div>`;
            resultsDiv.style.display = 'block';
            return;
        }
    } else if (ageInput) {
        if (!AgeCalculator.validateAge(ageInput)) {
            resultsDiv.innerHTML = `<div style="color: #e74c3c;">Please enter a valid age (0-120)</div>`;
            resultsDiv.style.display = 'block';
            return;
        }

        const ageNum = parseInt(ageInput);
        const refYear = referenceYear === 'current' ? new Date().getFullYear() : parseInt(referenceYear);

        result = this.calculateBirthYearFromAge(ageNum, refYear);

    } else {
        resultsDiv.innerHTML = `<div style="color: #e74c3c;">Please enter a birth date, birth year, or current age</div>`;
        resultsDiv.style.display = 'block';
        return;
    }

    if (result.error) {
        resultsDiv.innerHTML = `<div style="color: #e74c3c;">Error: ${result.error}</div>`;
    } else {
        this.displayAgeResults(result, resultsDiv);
    }

    resultsDiv.style.display = 'block';
    this.log('Age calculation completed');
}

calculateBirthYearFromAge(age, referenceYear = new Date().getFullYear()) {
    // Account for birthday possibly not occurring yet in the reference year
    const birthYear1 = referenceYear - age;
    const birthYear2 = referenceYear - age - 1;

    return {
        age: age,
        referenceYear: referenceYear,
        possibleBirthYears: [birthYear1, birthYear2],
        exactBirthYear: `Age ${age} in ${referenceYear} = born in ${birthYear1} or ${birthYear2}`,
        birthYearRange: `${birthYear2}-${birthYear1}`,
        currentAgeInCurrentYear: referenceYear === new Date().getFullYear() ?
            `Currently ${new Date().getFullYear() - birthYear1} or ${new Date().getFullYear() - birthYear2} years old` :
            `Would be ${new Date().getFullYear() - birthYear1} or ${new Date().getFullYear() - birthYear2} in current year`,
        type: 'from_age'
    };
}

displayAgeResults(result, resultsDiv) {
    let html = '<div style="font-weight: bold; margin-bottom: 5px;">Age Calculation Results:</div>';

    if (result.type === 'from_age') {
        // Display results for age number input
        html += `<div><strong>Input:</strong> Age ${result.age} in ${result.referenceYear}</div>`;
        html += `<div><strong>Possible Birth Years:</strong> ${result.birthYearRange}</div>`;
        html += `<div style="margin-top: 8px;"><strong>Details:</strong></div>`;
        html += `<div style="margin-left: 10px;">`;
        html += `<div>• Born in ${result.possibleBirthYears[0]} = ${result.referenceYear - result.possibleBirthYears[0]} years old in ${result.referenceYear}</div>`;
        html += `<div>• Born in ${result.possibleBirthYears[1]} = ${result.referenceYear - result.possibleBirthYears[1]} years old in ${result.referenceYear}</div>`;
        html += `</div>`;

        if (result.referenceYear === new Date().getFullYear()) {
            html += `<div style="margin-top: 8px; color: #27ae60;"><strong>Current Status:</strong> ${result.currentAgeInCurrentYear}</div>`;
        }

    } else {
        // Display results for date/year input (existing logic)
        html += `<div><strong>Exact Age:</strong> ${result.exactAge}</div>`;
        html += `<div><strong>Years:</strong> ${result.years}</div>`;

        if (!result.estimated) {
            html += `<div><strong>Months:</strong> ${result.months}</div>`;
            html += `<div><strong>Days:</strong> ${result.days}</div>`;
        }

        html += `<div style="margin-top: 5px;">`;
        html += `<span style="color: ${result.isAdult ? '#27ae60' : '#e74c3c'};">${result.isAdult ? '✓ Adult' : '✗ Minor'}</span>`;
        html += ` | <span style="color: ${result.isSenior ? '#e67e22' : '#666'}">${result.isSenior ? '✓ Senior' : 'Not Senior'}</span>`;
        html += `</div>`;

        if (result.estimated) {
            html += `<div style="margin-top: 5px; font-size: 10px; color: #f39c12;">Note: This is an estimate based on year only</div>`;
        }
    }

    // Add quick actions for birth year searches
    if (result.possibleBirthYears) {
        html += `<div style="margin-top: 10px; padding: 8px; background: #d5f4f1; border-radius: 3px;">`;
        html += `<div style="font-weight: bold; margin-bottom: 5px;">Quick Search Suggestions:</div>`;
        result.possibleBirthYears.forEach(year => {
            html += `<div style="font-size: 10px;">• Search for people born in ${year}</div>`;
        });
        html += `</div>`;
    }

    resultsDiv.innerHTML = html;
}

        saveVoterResult(voterInfo, voterData) {
            try {
                const pageKey = `ubc_vote.org_api_${Date.now()}`;
                const pageData = {
                    url: 'https://verify.vote.org/your-status (API)',
                    timestamp: new Date().toISOString(),
                    pageTitle: 'Vote.org API Check',
                    results: [voterInfo],
                    pageType: 'api_voter_check',
                    site: 'vote.org',
                    siteName: 'Vote.org',
                    searchData: voterData
                };

                GM_setValue(pageKey, pageData);

                // Add to the list of saved pages
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.push({
                    key: pageKey,
                    url: pageData.url,
                    timestamp: pageData.timestamp,
                    resultCount: 1,
                    site: 'vote.org',
                    siteName: 'Vote.org',
                    location: { state: voterData.state, cityOrCounty: voterData.city }
                });
                GM_setValue('ubc_saved_pages', savedPages);

                this.log('Saved voter check result');
                this.updatePreview();
            } catch (error) {
                this.log(`Error saving voter result: ${error}`);
            }
        }

        // ... (rest of the existing methods remain the same)
        generateSearchLinks() {
            const firstName = document.getElementById('ubcSearchFirstName').value.trim();
            const lastName = document.getElementById('ubcSearchLastName').value.trim();
            const city = document.getElementById('ubcSearchCity').value.trim();
            const state = document.getElementById('ubcSearchState').value.trim();

            // Validate inputs
            if (!SearchUtility.validateName(firstName) || !SearchUtility.validateName(lastName)) {
                this.log('Please enter both first and last name');
                return;
            }

            if (!SearchUtility.validateState(state)) {
                this.log('Please enter a state (required for all searches)');
                return;
            }

            // Generate URLs
            const urls = SearchUtility.generateSearchURLs(firstName, lastName, city, state);
            const resultsDiv = document.getElementById('ubcSearchResults');

            let html = '<div style="font-weight: bold; margin-bottom: 5px;">Generated Search Links:</div>';

            // FastPeopleSearch links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #27ae60;">FastPeopleSearch:</strong><br>';
            urls.fastpeoplesearch.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #27ae60; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            // FastBackgroundCheck links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #3498db;">FastBackgroundCheck:</strong><br>';
            urls.fastbackgroundcheck.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #3498db; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            // ZabaSearch links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #f39c12;">ZabaSearch:</strong><br>';
            urls.zabasearch.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #f39c12; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            // Whitepages links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #f39c12;">Whitepages:</strong><br>';
            urls.whitepages.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #f39c12; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            resultsDiv.innerHTML = html;
            resultsDiv.style.display = 'block';

            this.log(`Generated ${urls.fastpeoplesearch.length + urls.fastbackgroundcheck.length + urls.zabasearch.length + urls.whitepages.length} search links`);
        }

        log(message) {
            const statusElement = document.getElementById('ubcExporterStatus');
            const timestamp = new Date().toLocaleTimeString();
            statusElement.innerHTML = `<strong>Status:</strong> [${timestamp}] ${message}`;
            console.log(`[Universal Exporter] ${message}`);
        }

        saveCurrentPage() {
            if (!this.currentPageData || this.currentPageData.results.length === 0) {
                this.log('No data to save on current page');
                return;
            }

            try {
                const pageKey = `ubc_${this.site}_page_${Date.now()}`;
                const pageData = {
                    ...this.currentPageData,
                    site: this.site,
                    siteName: this.getSiteName()
                };

                GM_setValue(pageKey, pageData);

                // Also add to the list of saved pages
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.push({
                    key: pageKey,
                    url: this.currentPageData.url,
                    timestamp: this.currentPageData.timestamp,
                    resultCount: this.currentPageData.results.length,
                    site: this.site,
                    siteName: this.getSiteName(),
                    location: this.currentPageData.searchLocation
                });
                GM_setValue('ubc_saved_pages', savedPages);

                this.log(`Saved current page with ${this.currentPageData.results.length} records`);
                this.updatePreview();
            } catch (error) {
                this.log(`Error saving page: ${error}`);
            }
        }

        getSiteName() {
            const siteNames = {
                'fastbackgroundcheck': 'FastBackgroundCheck',
                'fastpeoplesearch': 'FastPeopleSearch',
                'zabasearch': 'ZabaSearch',
                // 'whitepages': 'Whitepages',
                'vote.org': 'Vote.org'
            };
            return siteNames[this.site] || this.site;
        }

        getAllSavedData(scope = 'all') {
            try {
                const savedPages = GM_getValue('ubc_saved_pages', []);
                let filteredPages = savedPages;

                if (scope === 'site_all') {
                    filteredPages = savedPages.filter(page => page.site === this.site);
                }

                const allData = [];
                filteredPages.forEach(pageInfo => {
                    const pageData = GM_getValue(pageInfo.key);
                    if (pageData) {
                        allData.push({
                            ...pageData,
                            savedKey: pageInfo.key
                        });
                    }
                });

                return allData;
            } catch (error) {
                this.log(`Error loading saved data: ${error}`);
                return [];
            }
        }

        updatePreview() {
            const format = document.getElementById('ubcExportFormat').value;
            const scope = document.getElementById('ubcDataScope').value;
            const previewDiv = document.getElementById('ubcResultsPreview');

            let dataToPreview;
            let title;

            if (scope === 'current') {
                dataToPreview = this.currentPageData;
                title = 'Current Page Data';
            } else {
                const allData = this.getAllSavedData(scope);
                dataToPreview = { pages: allData, totalPages: allData.length };
                const scopeText = scope === 'all' ? 'All Sites' : `All ${this.getSiteName()} Pages`;
                title = `${scopeText} (${allData.length} pages)`;
            }

            let previewContent = '';

            if (!dataToPreview || (scope !== 'current' && dataToPreview.totalPages === 0)) {
                previewContent = 'No data available for preview';
            } else {
                switch (format) {
                    case 'json':
                        previewContent = this.generateJSONPreview(dataToPreview, scope);
                        break;
                    case 'txt':
                        previewContent = this.generateTextPreview(dataToPreview, scope);
                        break;
                }
            }

            previewDiv.innerHTML = `
                <div style="margin-bottom: 5px; font-weight: bold;">${title}</div>
                <div style="font-family: monospace; white-space: pre-wrap; font-size: 10px;">${previewContent}</div>
            `;
        }

        generateJSONPreview(data, scope) {
            let previewData;
            if (scope === 'current') {
                previewData = {
                    site: this.site,
                    pageInfo: {
                        url: data.url,
                        timestamp: data.timestamp,
                        resultCount: data.results.length,
                        searchLocation: data.searchLocation
                    },
                    results: data.results.slice(0, 2)
                };
            } else {
                previewData = {
                    totalPages: data.totalPages,
                    pages: data.pages.slice(0, 1).map(page => ({
                        site: page.site,
                        url: page.url,
                        resultCount: page.results.length,
                        searchLocation: page.searchLocation,
                        sampleResults: page.results.slice(0, 1)
                    }))
                };
            }
            return JSON.stringify(previewData, null, 2);
        }

        generateTextPreview(data, scope) {
            if (scope === 'current') {
                let text = `${this.getSiteName().toUpperCase()} EXPORT\n`;
                text += `Page URL: ${data.url}\n`;
                text += `Results: ${data.results.length}\n`;
                if (data.searchLocation) {
                    const loc = data.searchLocation;
                    if (loc.state && loc.cityOrCounty) {
                        text += `Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                    } else if (loc.state) {
                        text += `Location: ${loc.state}\n`;
                    }
                }
                text += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
                text += '='.repeat(50) + '\n\n';

                data.results.slice(0, 2).forEach((result, index) => {
                    text += `Record ${index + 1}:\n`;
                    text += `  Name: ${result.name || 'N/A'}\n`;
                    if (result.age) text += `  Age: ${result.age}\n`;
                    if (result.location) text += `  Location: ${result.location}\n`;
                    if (result.aliases && result.aliases.length > 0) {
                        text += `  Aliases: ${result.aliases.join(', ')}\n`;
                    }
                    if (result.addresses && result.addresses.length > 0) {
                        const addrText = result.addresses.map(addr =>
                            typeof addr === 'string' ? addr : addr.address
                        ).join('; ');
                        text += `  Addresses: ${addrText}\n`;
                    }
                    if (result.phones && result.phones.length > 0) {
                        const phoneText = result.phones.map(phone =>
                            typeof phone === 'string' ? phone : phone.number
                        ).join('; ');
                        text += `  Phones: ${phoneText}\n`;
                    }
                    text += '\n';
                });

                if (data.results.length > 2) {
                    text += `... and ${data.results.length - 2} more results`;
                }
                return text;
            } else {
                return `Total saved pages: ${data.totalPages}\nExport to see complete data from all pages`;
            }
        }

        exportData() {
            const format = document.getElementById('ubcExportFormat').value;
            const scope = document.getElementById('ubcDataScope').value;

            let dataToExport;
            let filename;

            if (scope === 'current') {
                dataToExport = this.currentPageData;
                filename = `${this.site}_current_${Date.now()}.${format}`;
            } else {
                dataToExport = this.getAllSavedData(scope);
                const scopeText = scope === 'all' ? 'all_sites' : `all_${this.site}_pages`;
                filename = `background_checks_${scopeText}_${Date.now()}.${format}`;
            }

            if (!dataToExport || (scope !== 'current' && dataToExport.length === 0)) {
                this.log('No data to export');
                return;
            }

            try {
                let content = '';
                let mimeType = '';

                switch (format) {
                    case 'json':
                        content = this.convertToJSON(dataToExport, scope);
                        mimeType = 'application/json;charset=utf-8;';
                        break;
                    case 'txt':
                        content = this.convertToText(dataToExport, scope);
                        mimeType = 'text/plain;charset=utf-8;';
                        break;
                }

                const blob = new Blob([content], { type: mimeType });
                GM_download({
                    url: URL.createObjectURL(blob),
                    name: filename,
                    saveAs: true
                });

                const recordCount = scope === 'current' ? dataToExport.results.length :
                    dataToExport.reduce((sum, page) => sum + page.results.length, 0);

                let scopeText = '';
                if (scope === 'current') {
                    scopeText = 'current page';
                } else if (scope === 'site_all') {
                    scopeText = `${dataToExport.length} ${this.getSiteName()} pages`;
                } else {
                    scopeText = `${dataToExport.length} pages from all sites`;
                }

                this.log(`Exported ${recordCount} records from ${scopeText} as ${format.toUpperCase()}`);

            } catch (error) {
                this.log(`Export error: ${error}`);
            }
        }

        convertToJSON(data, scope) {
            if (scope === 'current') {
                return JSON.stringify({
                    site: this.site,
                    siteName: this.getSiteName(),
                    ...data
                }, null, 2);
            } else {
                return JSON.stringify({
                    exportScope: scope,
                    totalPages: data.length,
                    totalRecords: data.reduce((sum, page) => sum + page.results.length, 0),
                    sites: [...new Set(data.map(page => page.site))],
                    pages: data
                }, null, 2);
            }
        }

        convertToText(data, scope) {
            if (scope === 'current') {
                return this.siteExtractor.convertToText(data, scope);
            } else {
                let text = `UNIVERSAL BACKGROUND CHECK EXPORT\n`;
                text += `Export Time: ${new Date().toLocaleString()}\n`;
                text += `Scope: ${scope === 'all' ? 'All Sites' : `All ${this.getSiteName()} Pages`}\n`;
                text += `Total Pages: ${data.length}\n`;
                text += `Total Records: ${data.reduce((sum, page) => sum + page.results.length, 0)}\n`;

                // Group by site
                const sites = {};
                data.forEach(page => {
                    if (!sites[page.site]) {
                        sites[page.site] = [];
                    }
                    sites[page.site].push(page);
                });

                Object.keys(sites).forEach(site => {
                    const sitePages = sites[site];
                    const siteName = sitePages[0].siteName || site;
                    text += `\n${'='.repeat(60)}\n`;
                    text += `${siteName.toUpperCase()} - ${sitePages.length} PAGES\n`;
                    text += `${'='.repeat(60)}\n\n`;

                    sitePages.forEach((page, pageIndex) => {
                        text += `PAGE ${pageIndex + 1}: ${page.url}\n`;
                        text += `Time: ${new Date(page.timestamp).toLocaleString()}\n`;
                        text += `Records: ${page.results.length}\n`;
                        if (page.searchLocation) {
                            const loc = page.searchLocation;
                            if (loc.state && loc.cityOrCounty) {
                                text += `Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                            } else if (loc.state) {
                                text += `Location: ${loc.state}\n`;
                            }
                        }
                        text += '-'.repeat(50) + '\n\n';

                        page.results.slice(0, 3).forEach((result, resultIndex) => {
                            text += `  Record ${resultIndex + 1}: ${result.name || 'N/A'}\n`;
                            if (result.age) text += `    Age: ${result.age}\n`;
                            if (result.location) text += `    Location: ${result.location}\n`;
                            text += '\n';
                        });

                        if (page.results.length > 3) {
                            text += `  ... and ${page.results.length - 3} more records\n`;
                        }
                        text += '\n';
                    });
                });

                return text;
            }
        }

        viewSavedPages() {
            const savedPages = GM_getValue('ubc_saved_pages', []);
            const previewDiv = document.getElementById('ubcResultsPreview');

            if (savedPages.length === 0) {
                previewDiv.innerHTML = '<div>No saved pages found</div>';
                return;
            }

            // Group by site
            const sites = {};
            savedPages.forEach(page => {
                if (!sites[page.site]) {
                    sites[page.site] = [];
                }
                sites[page.site].push(page);
            });

            let html = '<div style="margin-bottom: 10px;"><strong>Saved Pages by Site:</strong></div>';

            Object.keys(sites).forEach(site => {
                const sitePages = sites[site];
                const siteName = sitePages[0].siteName || site;

                html += `<div style="margin-bottom: 10px; padding: 8px; background: #e8f4fd; border-radius: 4px;">
                    <strong>${siteName}</strong> (${sitePages.length} pages)
                </div>`;

                sitePages.forEach((page, index) => {
                    let locationInfo = '';
                    if (page.location) {
                        const loc = page.location;
                        if (loc.state && loc.cityOrCounty) {
                            locationInfo = `<br><small>Location: ${loc.cityOrCounty}, ${loc.state}</small>`;
                        } else if (loc.state) {
                            locationInfo = `<br><small>Location: ${loc.state}</small>`;
                        }
                    }

                    html += `
                        <div style="margin-bottom: 5px; padding: 5px; background: #f0f0f0; border-radius: 3px;">
                            <strong>${index + 1}.</strong> ${page.url}<br>
                            <small>Records: ${page.resultCount} | ${new Date(page.timestamp).toLocaleString()}</small>
                            ${locationInfo}
                        </div>
                    `;
                });
            });

            previewDiv.innerHTML = html;
        }

        clearAllData() {
            if (!confirm('Are you sure you want to clear ALL saved data from ALL sites?')) {
                return;
            }

            try {
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.forEach(page => {
                    GM_deleteValue(page.key);
                });
                GM_setValue('ubc_saved_pages', []);

                this.log(`Cleared all saved data (${savedPages.length} pages from all sites)`);
                this.updatePreview();
            } catch (error) {
                this.log(`Error clearing data: ${error}`);
            }
        }

        importSearchData() {
            // Implementation for import functionality
            // this.log('Import functionality coming soon');
            // Import data that was exported. Would be better.
        }
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new UniversalBackgroundCheckExporter(), 1000);
        });
    } else {
        setTimeout(() => new UniversalBackgroundCheckExporter(), 1000);
    }
})();