
        console.log("AI script loaded");

// Example: AI send button
document.getElementById("sendBtn")?.addEventListener("click", () => {
  console.log("Send clicked");
});

        // Configuration
        const CONFIG = {
            ApiKey: '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',
            ApiUrl: 'https://api.groq.com/openai/v1/chat/completions',
            DTUrl: 'https://ldrrdlugchfauxqsdsmf.supabase.co',
            DTAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkcnJkbHVnY2hmYXV4cXNkc21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NzI3NDgsImV4cCI6MjA4MTI0ODc0OH0.wxAbam0aRmpUvTn_VIHUfdkGXj5Qn8FILIeoSF97N7A'
        };

        const SYSTEM_PROMPT = `You are Wellness Oracle, expert AI wellness consultant from Wellness Oracle platform by Manoj Kumar Rai & Akshat Rai.

CRITICAL RULES:
- ALWAYS answer the user's question directly
- NEVER suggest or mention uploading reports or images
- Contact wellnessoracle.ai@gmail.com ONLY if user asks
- Always respond in user's language
- Be polite and professional

USER PERSONALIZATION:
- Learn from user's chat history and preferences
- Remember user's health conditions, medications, and concerns mentioned in past conversations
- Adapt responses based on user's previous interactions
- Provide increasingly personalized advice as you learn more about the user
- Reference past conversations when relevant to show continuity

PDF ANALYSIS CAPABILITY:
- Analyze PDF medical reports, lab results, prescriptions, and health documents when uploaded
- Provide detailed explanations of medical values and highlight abnormal ranges
- Suggest next steps based on the analysis
- Always include medical disclaimer when analyzing health documents

RESPONSE LENGTH RULES:
- If user asks to EXPLAIN/BRIEF/DESCRIBE AND requests a PDF: Write detailed explanation (800-900 words)
- If user requests PDF WITHOUT asking to explain: Normal informative length
- If NO PDF requested: Respond concisely (80-120 words)
- If analyzing uploaded PDF: Provide comprehensive analysis (600-800 words)

Medical note: "Consult a healthcare professional for diagnosis or treatment."`;

        // PDF Generation Keywords - Comprehensive list
        const PDF_KEYWORDS = [
            // Direct PDF requests
            'pdf', 'make pdf', 'create pdf', 'generate pdf', 'create a pdf',
            'make a pdf', 'generate a pdf', 'pdf report', 'pdf document',
            'give me pdf', 'give me a pdf', 'send pdf', 'send me pdf',
            'download pdf', 'i want pdf', 'i need pdf', 'can you make pdf',
            'can you create pdf', 'can you generate pdf', 'pdf please',
            'in pdf', 'as pdf', 'into pdf', 'to pdf', 'pdf format',
            'pdf file', 'pdf version', 'export pdf', 'save as pdf',
            'provide pdf', 'share pdf', 'get pdf',
            
            // Related document requests
            'document', 'report', 'file', 'download', 'export',
            'save', 'make document', 'create document', 'generate document',
            'make report', 'create report', 'generate report',
            'downloadable', 'printable', 'written document',
            'save this', 'export this',
            
            // Action-oriented
            'write it', 'write this', 'put it in', 'convert to',
            'make it into', 'turn into', 'save it', 'export it',
            'convert this to', 'turn this into',
            
            // Health-specific PDF requests
            'health report', 'medical report', 'wellness report',
            'diet plan pdf', 'exercise plan pdf', 'treatment plan pdf',
            'prescription format', 'summary document', 'detailed report',
            'health summary', 'medical summary'
        ];

        // State
        let currentUser = null;
        let isAuthenticated = false;
        let uploadedFile = null;
        let uploadedPDFText = null; // Store extracted PDF text
        let conversationHistory = [];
        let chatSessions = [];
        let currentSessionId = null;
        let messageCount = 0;
        let isLoading = false;
        let generatedPDF = null;
        let lastAIResponse = "";
        let userLearningData = {}; // Store learned user preferences and patterns

        // Enhanced PDF Text Extraction Function
        async function extractPDFText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = async function(e) {
                    try {
                        const arrayBuffer = e.target.result;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        
                        // Simple text extraction from PDF
                        const decoder = new TextDecoder('utf-8');
                        const pdfText = decoder.decode(uint8Array);
                        const matches = pdfText.match(/\(([^)]+)\)/g);
                        
                        let text = '';
                        if (matches && matches.length > 10) {
                            // Text-based PDF
                            text = matches.map(m => m.replace(/[()]/g, '')).join(' ');
                        }
                        
                        // If no text found or very little text, use OCR
                        if (!text || text.length < 100) {
                            console.log('Using OCR for PDF...');
                            // Convert PDF to image and use OCR
                            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                            const url = URL.createObjectURL(blob);
                            
                            // Use Tesseract.js for OCR if available
                            if (typeof Tesseract !== 'undefined') {
                                showSuccess('Analyzing PDF with OCR... This may take a moment.');
                                const result = await Tesseract.recognize(url, 'eng', {
                                    logger: m => console.log(m)
                                });
                                text = result.data.text;
                                URL.revokeObjectURL(url);
                            } else {
                                text = 'PDF uploaded. Please describe the key information you want me to analyze.';
                            }
                        }
                        
                        resolve(text || 'Unable to extract text from PDF. Please describe the content.');
                    } catch (error) {
                        console.error('PDF extraction error:', error);
                        reject('Error extracting PDF text. Please try again or describe the content.');
                    }
                };
                
                reader.onerror = () => reject('Error reading PDF file');
                reader.readAsArrayBuffer(file);
            });
        }

        // Check if message requests PDF generation
        function shouldGeneratePDF(message) {
            const lowerMessage = message.toLowerCase();
            return PDF_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
        }

        // Learn from user interactions
        function learnFromUserMessage(message, response) {
            if (!isAuthenticated) return;

            // Extract health conditions
            const healthKeywords = ['diabetes', 'hypertension', 'asthma', 'allergy', 'allergic', 
                                   'thyroid', 'heart', 'cholesterol', 'pressure', 'sugar'];
            healthKeywords.forEach(keyword => {
                if (message.toLowerCase().includes(keyword)) {
                    if (!userLearningData.healthConcerns) userLearningData.healthConcerns = [];
                    if (!userLearningData.healthConcerns.includes(keyword)) {
                        userLearningData.healthConcerns.push(keyword);
                    }
                }
            });

            // Extract medications
            const medKeywords = ['medication', 'medicine', 'drug', 'pill', 'tablet', 'taking', 'prescribed'];
            medKeywords.forEach(keyword => {
                if (message.toLowerCase().includes(keyword)) {
                    if (!userLearningData.medications) userLearningData.medications = [];
                    userLearningData.medications.push(message);
                }
            });

            // Extract lifestyle preferences
            if (message.toLowerCase().includes('diet') || message.toLowerCase().includes('food')) {
                if (!userLearningData.dietaryInterests) userLearningData.dietaryInterests = [];
                userLearningData.dietaryInterests.push(message);
            }

            if (message.toLowerCase().includes('exercise') || message.toLowerCase().includes('workout')) {
                if (!userLearningData.fitnessInterests) userLearningData.fitnessInterests = [];
                userLearningData.fitnessInterests.push(message);
            }

            // Track frequently asked topics
            if (!userLearningData.topicFrequency) userLearningData.topicFrequency = {};
            const words = message.toLowerCase().split(' ').filter(w => w.length > 4);
            words.forEach(word => {
                userLearningData.topicFrequency[word] = (userLearningData.topicFrequency[word] || 0) + 1;
            });

            // Save learning data
            saveUserLearningData();
        }

        // Save user learning data
        function saveUserLearningData() {
            if (!isAuthenticated || !currentUser) return;
            localStorage.setItem(`user_learning_${currentUser.id}`, JSON.stringify(userLearningData));
        }

        // Load user learning data
        function loadUserLearningData() {
            if (!isAuthenticated || !currentUser) return;
            const saved = localStorage.getItem(`user_learning_${currentUser.id}`);
            if (saved) {
                userLearningData = JSON.parse(saved);
            }
        }

        // Build personalized context for AI
        function buildPersonalizedContext() {
            if (!userLearningData || Object.keys(userLearningData).length === 0) return '';

            let context = '\n\nUSER CONTEXT (use this to personalize your responses):\n';
            
            if (userLearningData.healthConcerns && userLearningData.healthConcerns.length > 0) {
                context += `- Health concerns: ${userLearningData.healthConcerns.join(', ')}\n`;
            }
            
            if (userLearningData.medications && userLearningData.medications.length > 0) {
                const recentMeds = userLearningData.medications.slice(-3);
                context += `- Mentioned medications: ${recentMeds.join('; ')}\n`;
            }
            
            if (userLearningData.dietaryInterests && userLearningData.dietaryInterests.length > 0) {
                context += `- Interested in diet/nutrition\n`;
            }
            
            if (userLearningData.fitnessInterests && userLearningData.fitnessInterests.length > 0) {
                context += `- Interested in fitness/exercise\n`;
            }

            return context;
        }

        // Mobile Sidebar Functions
        function openSidebar() {
            document.getElementById('sidebar').classList.add('active');
            document.getElementById('sidebarOverlay').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
            document.body.style.overflow = '';
        }

        // Initialize
        function init() {
            checkAuthStatus();
            setupEventListeners();
            autoResizeTextarea();
            loadChatSessions();
        }

        function setupEventListeners() {
            const messageInput = document.getElementById('messageInput');
            const fileInput = document.getElementById('fileInput');
            
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            messageInput.addEventListener('input', autoResizeTextarea);
            fileInput.addEventListener('change', handleFileUpload);

            // Close sidebar on window resize to desktop
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    closeSidebar();
                }
            });
        }

        function autoResizeTextarea() {
            const textarea = document.getElementById('messageInput');
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }

        // Auth Functions
        function checkAuthStatus() {
            const user = localStorage.getItem('wellness_user');
            if (user) {
                currentUser = JSON.parse(user);
                showUserProfile();
                isAuthenticated = true;
                loadChatSessions();
                loadUserLearningData(); // Load user learning data
            }
        }

        function showUserProfile() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('userSection').classList.add('active');

            const initials = currentUser.full_name?.substring(0, 2).toUpperCase() || 'U';
            document.getElementById('userAvatar').textContent = initials;
            document.getElementById('userName').textContent = currentUser.full_name || 'User';
            document.getElementById('userEmail').textContent = currentUser.email;
        }

        function hideUserProfile() {
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('userSection').classList.remove('active');
        }

        function showAuthModal(tab = 'signin') {
            document.getElementById('authModal').classList.add('active');
            switchAuthTab(tab);
            closeSidebar();
        }

        function closeAuthModal() {
            document.getElementById('authModal').classList.remove('active');
        }

        function switchAuthTab(tab) {
            const tabs = document.querySelectorAll('.auth-tab');
            const forms = document.querySelectorAll('.auth-form');

            tabs.forEach(t => t.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));

            document.querySelector(`[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
            document.getElementById(tab + 'Form').classList.add('active');
        }

        async function signUp() {
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value.trim();

            if (!name || !email || !password) {
                showError('Please fill all fields');
                return;
            }

            try {
                const response = await fetch(`${CONFIG.DTUrl}/rest/v1/users_profiles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': CONFIG.DTAnonKey,
                        'Authorization': `Bearer ${CONFIG.DTAnonKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify([{
                        email,
                        name,
                        full_name: name,
                        created_at: new Date().toISOString()
                    }])
                });

                if (!response.ok) throw new Error('Signup failed');

                const users = await response.json();
                currentUser = users[0];
                localStorage.setItem('wellness_user', JSON.stringify(currentUser));
                isAuthenticated = true;

                closeAuthModal();
                showUserProfile();
                showSuccess('Account created successfully!');
                loadChatSessions();
                loadUserLearningData(); // Load learning data for new user
            } catch (error) {
                showError(error.message);
            }
        }

        async function signIn() {
            const email = document.getElementById('signinEmail').value.trim();
            const password = document.getElementById('signinPassword').value.trim();

            if (!email || !password) {
                showError('Please enter email and password');
                return;
            }

            try {
                const response = await fetch(`${CONFIG.DTUrl}/rest/v1/users_profiles?email=eq.${encodeURIComponent(email)}`, {
                    headers: {
                        'apikey': CONFIG.DTAnonKey,
                        'Authorization': `Bearer ${CONFIG.DTAnonKey}`
                    }
                });

                if (!response.ok) throw new Error('Invalid credentials');

                const users = await response.json();
                if (users.length === 0) throw new Error('User not found');

                currentUser = users[0];
                localStorage.setItem('wellness_user', JSON.stringify(currentUser));
                isAuthenticated = true;

                closeAuthModal();
                showUserProfile();
                showSuccess('Welcome back!');
                loadChatSessions();
                loadUserLearningData(); // Load user's learning data
            } catch (error) {
                showError(error.message);
            }
        }

        function logout() {
            if (!confirm('Are you sure you want to logout?')) return;
            
            currentUser = null;
            isAuthenticated = false;
            userLearningData = {}; // Clear learning data
            localStorage.removeItem('wellness_user');
            
            hideUserProfile();
            startNewChat();
            showSuccess('Logged out successfully');
            closeSidebar();
        }

        async function deleteAccount() {
            if (!confirm('Are you sure you want to delete your account? This will delete all your data permanently.')) {
                return;
            }

            try {
                await fetch(`${CONFIG.DTUrl}/rest/v1/users_profiles?id=eq.${currentUser.id}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': CONFIG.DTAnonKey,
                        'Authorization': `Bearer ${CONFIG.DTAnonKey}`
                    }
                });

                // Clear all local data
                localStorage.removeItem('wellness_user');
                localStorage.removeItem(`user_learning_${currentUser.id}`);
                localStorage.removeItem('chatSessions');
                
                currentUser = null;
                isAuthenticated = false;
                userLearningData = {};
                chatSessions = [];
                
                hideUserProfile();
                startNewChat();
                showSuccess('Account deleted successfully');
                closeSidebar();
            } catch (error) {
                showError('Failed to delete account');
            }
        }

        // Enhanced File Upload Handler with PDF Support
        async function handleFileUpload(e) {
            if (!isAuthenticated) {
                showError('Login required to upload files');
                showAuthModal('signin');
                return;
            }

            const file = e.target.files[0];
            if (!file) return;

            const fileType = file.type;
            const isImage = fileType.startsWith('image/');
            const isPDF = fileType === 'application/pdf';

            if (!isImage && !isPDF) {
                showError('Only images and PDF files are supported');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showError('File must be under 10MB');
                return;
            }

            uploadedFile = file;
            uploadedPDFText = null;

            const uploadDiv = document.getElementById('uploadedFile');
            
            if (isPDF) {
                // Extract PDF text
                showSuccess('Processing PDF... Please wait...');
                try {
                    uploadedPDFText = await extractPDFText(file);
                    uploadDiv.innerHTML = `
                        <div class="pdf-preview-container">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pdf-icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span class="file-name">${file.name}</span>
                            <button onclick="removeFile()" class="remove-file-btn" title="Remove PDF">×</button>
                        </div>
                    `;
                    showSuccess('PDF processed! You can now ask questions about it.');
                } catch (error) {
                    showError(error);
                    uploadedFile = null;
                    uploadDiv.innerHTML = '';
                }
            } else if (isImage) {
                // Image preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadDiv.innerHTML = `
                        <div class="image-preview-container">
                            <img src="${e.target.result}" alt="Uploaded preview" class="preview-image">
                            <button onclick="removeFile()" class="remove-preview-btn" title="Remove image">×</button>
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
                showSuccess('Image uploaded!');
            }

            e.target.value = '';
        }

        function removeFile() {
            uploadedFile = null;
            uploadedPDFText = null;
            document.getElementById('uploadedFile').innerHTML = '';
        }

        // Chat Management
        function startNewChat() {
            currentSessionId = Date.now().toString();
            conversationHistory = [];
            messageCount = 0;
            generatedPDF = null;
            lastAIResponse = "";

            document.getElementById('welcomeSection').style.display = 'flex';
            document.getElementById('messagesContainer').style.display = 'none';
            document.getElementById('messagesContainer').innerHTML = '';
            
            saveChatSession();
            closeSidebar();
        }

        function saveChatSession() {
            if (!currentSessionId) return;
            
            const session = chatSessions.find(s => s.id === currentSessionId);
            const messages = Array.from(document.querySelectorAll('.message')).map(msg => ({
                role: msg.classList.contains('user') ? 'user' : 'oracle',
                content: msg.querySelector('.message-content').textContent.trim()
            }));

            if (session) {
                session.messages = messages;
                session.timestamp = Date.now();
                session.count = messages.length;
            } else if (messages.length > 0) {
                const title = messages[0].content.substring(0, 40) + '...';
                chatSessions.unshift({
                    id: currentSessionId,
                    title,
                    messages,
                    timestamp: Date.now(),
                    count: messages.length
                });
            }

            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            updateChatHistory();
        }

        function loadChatSessions() {
            const saved = localStorage.getItem('chatSessions');
            if (saved) {
                chatSessions = JSON.parse(saved);
                updateChatHistory();
            }
        }

        function updateChatHistory() {
            const historyDiv = document.getElementById('chatHistory');
            if (!historyDiv) return;

            if (chatSessions.length === 0) {
                historyDiv.innerHTML = '<div class="empty-history">No chat history yet</div>';
                return;
            }

            historyDiv.innerHTML = chatSessions.map(session => `
                <div class="chat-history-item ${session.id === currentSessionId ? 'active' : ''}">
                    <div class="chat-history-item-body" onclick="loadChat('${session.id}')">
                        <div class="chat-title">${session.title}</div>
                        <div class="chat-meta">${session.count} messages • ${new Date(session.timestamp).toLocaleDateString()}</div>
                    </div>
                    <button class="chat-delete-btn" onclick="event.stopPropagation(); deleteSingleChat('${session.id}')" aria-label="Delete chat" title="Delete this chat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `).join('');
        }

        function deleteSingleChat(sessionId) {
            if (!confirm('Delete this chat?')) return;

            chatSessions = chatSessions.filter(s => s.id !== sessionId);
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));

            // If the deleted chat was the current one, start fresh
            if (currentSessionId === sessionId) {
                startNewChat();
            }

            updateChatHistory();
            showSuccess('Chat deleted');
        }

        function loadChat(sessionId) {
            const session = chatSessions.find(s => s.id === sessionId);
            if (!session) return;

            currentSessionId = sessionId;
            conversationHistory = session.messages || [];

            document.getElementById('welcomeSection').style.display = 'none';
            document.getElementById('messagesContainer').style.display = 'flex';

            const container = document.getElementById('messagesContainer');
            container.innerHTML = '';

            session.messages.forEach(msg => {
                addMessageToUI(msg.content, msg.role);
            });

            updateChatHistory();
            closeSidebar();
        }

        function clearAllHistory() {
            if (!confirm('Delete all chat history? This cannot be undone.')) return;

            chatSessions = [];
            localStorage.removeItem('chatSessions');
            updateChatHistory();
            startNewChat();
            showSuccess('All history cleared');
            closeSidebar();
        }

        // Message Functions
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();

            if (!message && !uploadedFile) {
                showError('Please enter a message or upload a file');
                return;
            }

            if (isLoading) return;

            if (!currentSessionId) {
                currentSessionId = Date.now().toString();
            }

            document.getElementById('welcomeSection').style.display = 'none';
            document.getElementById('messagesContainer').style.display = 'flex';

            // Prepare message content
            let displayMessage = message;
            let apiMessage = message;

            if (uploadedPDFText) {
                displayMessage = message + ` [PDF: ${uploadedFile.name}]`;
                apiMessage = `I have uploaded a PDF document. Here is the extracted content:\n\n${uploadedPDFText}\n\nUser question: ${message}`;
            } else if (uploadedFile && uploadedFile.type.startsWith('image/')) {
                displayMessage = message + ` [Image: ${uploadedFile.name}]`;
            }

            addMessageToUI(displayMessage, 'user');
            
            input.value = '';
            autoResizeTextarea();

            const tempFile = uploadedFile;
            const tempPDFText = uploadedPDFText;
            removeFile();

            isLoading = true;
            const loadingMsg = addLoadingMessage();

            try {
                const aiResponse = await callGroqAPI(apiMessage, tempFile, tempPDFText);
                
                removeLoadingMessage(loadingMsg);
                addMessageToUI(aiResponse, 'oracle');
                
                lastAIResponse = aiResponse;

                // Learn from this interaction
                learnFromUserMessage(message, aiResponse);

                // Check if PDF should be generated
                if (shouldGeneratePDF(message)) {
                    generatePDF(message, aiResponse);
                    showPDFDownloadMessage();
                }

                saveChatSession();
                saveChatToSupabase(displayMessage, aiResponse);
                
            } catch (error) {
                removeLoadingMessage(loadingMsg);
                addMessageToUI('Sorry, something went wrong. Please try again.', 'oracle');
                showError('Failed to get response');
            } finally {
                isLoading = false;
            }
        }

        function addMessageToUI(content, role) {
            const container = document.getElementById('messagesContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${role}`;

            if (role === 'oracle') {
                // Oracle: AI icon avatar on the left, then message
                messageDiv.innerHTML = `
                    <div class="message-avatar oracle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                    </div>
                    <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
                `;
            } else {
                // User: Message first, then avatar (will be reversed by CSS)
                messageDiv.innerHTML = `
                    <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
                    <div class="message-avatar user">U</div>
                `;
            }

            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;
        }

        function addLoadingMessage() {
            const container = document.getElementById('messagesContainer');
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message oracle loading';
            loadingDiv.id = 'loading-' + Date.now();

            loadingDiv.innerHTML = `
                <div class="message-avatar oracle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                </div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;

            container.appendChild(loadingDiv);
            container.scrollTop = container.scrollHeight;
            return loadingDiv.id;
        }

        function removeLoadingMessage(id) {
            const loadingMsg = document.getElementById(id);
            if (loadingMsg) loadingMsg.remove();
        }

        // API Call with Learning Context
        async function callGroqAPI(message, imageFile = null, pdfText = null) {
            let userContent = message;
            let dynamicInstruction = '';

            // Add personalized context from learning data
            const personalizedContext = buildPersonalizedContext();
            dynamicInstruction += personalizedContext;

            // Add conversation history for context
            if (conversationHistory.length > 0) {
                const recentHistory = conversationHistory.slice(-6); // Last 6 messages
                dynamicInstruction += '\n\nRECENT CONVERSATION:\n';
                recentHistory.forEach((msg, idx) => {
                    const role = msg.role === 'user' ? 'User' : 'Assistant';
                    dynamicInstruction += `${role}: ${msg.content}\n`;
                });
            }

            const wantsPDF = shouldGeneratePDF(message);
            const longPDF = /explain|brief|describe|detail|elaborate/i.test(message);

            if (imageFile && !pdfText) {
                const extractedText = await extractTextFromImage(imageFile);
                userContent = `${message}\n\n[Extracted from image: ${extractedText}]`;
            }

            const response = await fetch(CONFIG.ApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIG.ApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + dynamicInstruction },
                        { role: 'user', content: userContent }
                    ],
                    temperature: 0.7,
                    max_tokens: wantsPDF && longPDF ? 1800 : 800
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            const aiResponse = data.choices[0].message.content;

            // Add to conversation history
            conversationHistory.push(
                { role: 'user', content: userContent },
                { role: 'assistant', content: aiResponse }
            );

            return aiResponse;
        }

        async function extractTextFromImage(file) {
            try {
                const reader = new FileReader();
                return new Promise((resolve) => {
                    reader.onload = async (e) => {
                        const { data: { text } } = await Tesseract.recognize(e.target.result, 'eng');
                        resolve(text);
                    };
                    reader.readAsDataURL(file);
                });
            } catch (error) {
                return '';
            }
        }

        function fileToBase64(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
        }

        // PDF Generation
        function generatePDF(userQuery, content) {
            const { jsPDF } = window.jspdf;
            generatedPDF = new jsPDF();

            const pageWidth = generatedPDF.internal.pageSize.getWidth();
            const pageHeight = generatedPDF.internal.pageSize.getHeight();
            let y = 20;

            generatedPDF.setFontSize(18);
            generatedPDF.text(userQuery.toUpperCase(), 10, y);
            y += 20;

            generatedPDF.setFontSize(11);
            const lines = generatedPDF.splitTextToSize(content, pageWidth - 20);

            lines.forEach(line => {
                if (y > pageHeight - 20) {
                    generatedPDF.addPage();
                    y = 20;
                }
                generatedPDF.text(line, 10, y);
                y += 7;
            });
        }

        function showPDFDownloadMessage() {
            const container = document.getElementById('messagesContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message oracle';

            messageDiv.innerHTML = `
                <div class="message-avatar oracle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                </div>
                <div class="message-content">
                    <strong>Your PDF is ready!</strong><br>
                    <button class="auth-btn" style="margin-top: 12px; font-size: 14px; padding: 10px 16px;" onclick="downloadPDF()">
                        Download PDF
                    </button>
                </div>
            `;

            container.appendChild(messageDiv);
        }

        function downloadPDF() {
            if (generatedPDF) {
                generatedPDF.save('Wellness_Oracle_Report.pdf');
            }
        }

        async function saveChatToSupabase(question, response) {
            if (!isAuthenticated) return;
            
            try {
                const userId = currentUser.id;
                await fetch(`${CONFIG.DTUrl}/rest/v1/wellnesschathistory`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': CONFIG.DTAnonKey,
                        'Authorization': `Bearer ${CONFIG.DTAnonKey}`
                    },
                    body: JSON.stringify({
                        question,
                        response,
                        user_id: userId,
                        created_at: new Date().toISOString()
                    })
                });
            } catch (error) {
                console.warn('Could not save to Supabase');
            }
        }

        // UI Functions
        function showError(message) {
            document.getElementById('errorMessage').innerHTML = 
                `<div class="error-message">${message}</div>`;
            setTimeout(() => {
                document.getElementById('errorMessage').innerHTML = '';
            }, 5000);
        }

        function showSuccess(message) {
            document.getElementById('errorMessage').innerHTML = 
                `<div class="success-message">${message}</div>`;
            setTimeout(() => {
                document.getElementById('errorMessage').innerHTML = '';
            }, 3000);
        }

        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        }

        function exportChat() {
            if (!currentSessionId) {
                showError('No chat to export');
                return;
            }

            const session = chatSessions.find(s => s.id === currentSessionId);
            if (!session) return;

            const text = session.messages.map(m => 
                `${m.role === 'user' ? 'You' : 'Wellness Oracle'}: ${m.content}`
            ).join('\n\n');

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wellness-chat-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            
            showSuccess('Chat exported!');
            closeSidebar();
        }


        // About & Legal Modal Functions
        function openAboutLegal() {
            const modal = document.getElementById('legalModal');
            const container = document.getElementById('legalContentContainer');
            
            // Fetch and load the footer content
            fetch('footer.html')
                .then(response => response.text())
                .then(data => {
                    container.innerHTML = data;
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    closeSidebar(); // Close sidebar on mobile
                })
                .catch(error => {
                    console.error('Error loading footer:', error);
                    showError('Could not load About & Legal information');
                });
        }

        function closeLegalModal() {
            const modal = document.getElementById('legalModal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Close modal when clicking outside
        document.addEventListener('click', function(event) {
            const modal = document.getElementById('legalModal');
            if (event.target === modal) {
                closeLegalModal();
            }
        });


        // Password visibility toggle
        function togglePassword(inputId, btn) {
            const input = document.getElementById(inputId);
            const eyeOpen  = btn.querySelector('.eye-open');
            const eyeOff   = btn.querySelector('.eye-off');

            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.style.display  = 'none';
                eyeOff.style.display   = 'block';
            } else {
                input.type = 'password';
                eyeOpen.style.display  = 'block';
                eyeOff.style.display   = 'none';
            }
        }

        // Initialize app
        init();

        