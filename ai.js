
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

RESPONSE LENGTH RULES:
- If user asks to EXPLAIN/BRIEF/DESCRIBE AND requests a PDF: Write detailed explanation (800-900 words)
- If user requests PDF WITHOUT asking to explain: Normal informative length
- If NO PDF requested: Respond concisely (80-120 words)

Medical note: "Consult a healthcare professional for diagnosis or treatment."`;

        // State
        let currentUser = null;
        let isAuthenticated = false;
        let uploadedFile = null;
        let conversationHistory = [];
        let chatSessions = [];
        let currentSessionId = null;
        let messageCount = 0;
        let isLoading = false;
        let generatedPDF = null;
        let lastAIResponse = "";

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
            } catch (error) {
                showError(error.message);
            }
        }

        function logout() {
            localStorage.removeItem('wellness_user');
            currentUser = null;
            isAuthenticated = false;
            
            hideUserProfile();
            startNewChat();
            chatSessions = [];
            renderChatHistory();
            showSuccess('Logged out successfully');
            closeSidebar();
        }

        async function deleteAccount() {
            if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                return;
            }

            if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
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

                await fetch(`${CONFIG.DTUrl}/rest/v1/wellnesschathistory?user_id=eq.${currentUser.id}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': CONFIG.DTAnonKey,
                        'Authorization': `Bearer ${CONFIG.DTAnonKey}`
                    }
                });

                logout();
                showSuccess('Account deleted successfully');
            } catch (error) {
                showError('Failed to delete account');
            }
        }

        // Chat Sessions Management
        function loadChatSessions() {
            const stored = localStorage.getItem('chat_sessions');
            if (stored) {
                chatSessions = JSON.parse(stored);
                renderChatHistory();
            }
        }

        function saveChatSessions() {
            localStorage.setItem('chat_sessions', JSON.stringify(chatSessions));
        }

        function createNewSession() {
            const sessionId = 'chat_' + Date.now();
            const session = {
                id: sessionId,
                title: 'New Chat',
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            chatSessions.unshift(session);
            saveChatSessions();
            return sessionId;
        }

        function updateSessionTitle(sessionId, firstMessage) {
            const session = chatSessions.find(s => s.id === sessionId);
            if (session && session.title === 'New Chat') {
                session.title = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? '...' : '');
                saveChatSessions();
                renderChatHistory();
            }
        }

        function renderChatHistory() {
            const historyContainer = document.getElementById('chatHistory');
            
            if (chatSessions.length === 0) {
                historyContainer.innerHTML = '<div class="empty-history">No chat history yet</div>';
                return;
            }

            historyContainer.innerHTML = chatSessions.map(session => `
                <div class="chat-history-item ${currentSessionId === session.id ? 'active' : ''}" 
                     onclick="loadChatSession('${session.id}')">
                    <svg class="icon chat-icon" viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <div class="chat-text">
                        <div class="chat-title">${session.title}</div>
                        <div class="chat-time">${formatTime(session.updatedAt)}</div>
                    </div>
                    <button class="delete-chat-btn" onclick="event.stopPropagation(); deleteChatSession('${session.id}')">
                        <svg class="icon-sm" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('');
        }

        function loadChatSession(sessionId) {
            const session = chatSessions.find(s => s.id === sessionId);
            if (!session) return;

            currentSessionId = sessionId;
            conversationHistory = session.messages;
            
            const container = document.getElementById('messagesContainer');
            container.innerHTML = '';
            
            document.getElementById('welcomeSection').style.display = 'none';
            container.style.display = 'block';

            session.messages.forEach(msg => {
                addMessage(msg.role, msg.content, false);
            });

            document.getElementById('currentChatTitle').textContent = session.title;
            renderChatHistory();
            closeSidebar();
        }

        function deleteChatSession(sessionId) {
            if (!confirm('Delete this chat?')) return;

            chatSessions = chatSessions.filter(s => s.id !== sessionId);
            saveChatSessions();

            if (currentSessionId === sessionId) {
                startNewChat();
            }

            renderChatHistory();
            showSuccess('Chat deleted');
        }

        function clearAllHistory() {
            if (!confirm('Clear all chat history? This cannot be undone.')) return;

            chatSessions = [];
            saveChatSessions();
            startNewChat();
            renderChatHistory();
            showSuccess('All history cleared');
            closeSidebar();
        }

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        }

        // File Upload
        function handleFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showError('File too large (max 5MB)');
                return;
            }

            uploadedFile = file;
            displayUploadedFile(file);
        }

        function displayUploadedFile(file) {
            const uploadedFileDiv = document.getElementById('uploadedFile');
            uploadedFileDiv.innerHTML = `
                <div class="uploaded-file-info">
                    <span>📎 ${file.name} (${(file.size / 1024).toFixed(2)}KB)</span>
                    <button class="remove-file-btn" onclick="removeUploadedFile()">Remove</button>
                </div>
            `;
        }

        function removeUploadedFile() {
            uploadedFile = null;
            document.getElementById('fileInput').value = '';
            document.getElementById('uploadedFile').innerHTML = '';
        }

        // Chat Functions
        function startNewChat() {
            currentSessionId = null;
            conversationHistory = [];
            messageCount = 0;
            
            document.getElementById('welcomeSection').style.display = 'block';
            document.getElementById('messagesContainer').style.display = 'none';
            document.getElementById('messagesContainer').innerHTML = '';
            document.getElementById('currentChatTitle').textContent = 'Wellness Chat';
            renderChatHistory();
            closeSidebar();
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();

            if (!message && !uploadedFile) return;
            if (isLoading) return;

            if (!isAuthenticated && messageCount >= 3) {
                showAuthModal('signin');
                return;
            }

            try {
                isLoading = true;
                document.getElementById('sendBtn').disabled = true;

                if (!currentSessionId) {
                    currentSessionId = createNewSession();
                }

                document.getElementById('welcomeSection').style.display = 'none';
                document.getElementById('messagesContainer').style.display = 'block';

                addMessage('user', message, true);
                input.value = '';
                autoResizeTextarea();
                messageCount++;

                if (messageCount === 1) {
                    updateSessionTitle(currentSessionId, message);
                    document.getElementById('currentChatTitle').textContent = message.substring(0, 40) + (message.length > 40 ? '...' : '');
                }

                showTypingIndicator();

                let fileBase64 = null;
                if (uploadedFile) {
                    fileBase64 = await fileToBase64(uploadedFile);
                }

                const response = await getGroqResponse(message, uploadedFile, fileBase64);
                removeTypingIndicator();

                const wantsPDF = /generate\s+pdf/i.test(message);
                lastAIResponse = response;

                if (wantsPDF) {
                    generatePDF(message, response);
                    showPDFDownloadMessage();
                } else {
                    addMessage('oracle', response, true);
                }

                const session = chatSessions.find(s => s.id === currentSessionId);
                if (session) {
                    session.updatedAt = new Date().toISOString();
                    saveChatSessions();
                    renderChatHistory();
                }

                await saveChatToSupabase(message, response);
                removeUploadedFile();

            } catch (error) {
                removeTypingIndicator();
                showError('Error: ' + error.message);
            } finally {
                isLoading = false;
                document.getElementById('sendBtn').disabled = false;
            }
        }

        function addMessage(type, content, saveToSession = false) {
            const container = document.getElementById('messagesContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;

            const avatar = document.createElement('div');
            avatar.className = `message-avatar ${type}`;
            
            if (type === 'oracle') {
                avatar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                `;
            } else {
                avatar.textContent = currentUser?.full_name?.substring(0, 1) || 'U';
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;

            if (type === 'user') {
                messageDiv.appendChild(contentDiv);
                messageDiv.appendChild(avatar);
            } else {
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(contentDiv);
            }

            container.appendChild(messageDiv);
            container.parentElement.scrollTop = container.parentElement.scrollHeight;

            if (saveToSession && currentSessionId) {
                const session = chatSessions.find(s => s.id === currentSessionId);
                if (session) {
                    session.messages.push({ role: type, content });
                    saveChatSessions();
                }
            }
        }

        function showTypingIndicator() {
            const container = document.getElementById('messagesContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message oracle';
            messageDiv.id = 'typingIndicator';

            messageDiv.innerHTML = `
                <div class="message-avatar oracle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                </div>
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;

            container.appendChild(messageDiv);
            container.parentElement.scrollTop = container.parentElement.scrollHeight;
        }

        function removeTypingIndicator() {
            const indicator = document.getElementById('typingIndicator');
            if (indicator) indicator.remove();
        }

        async function getGroqResponse(question, file, fileBase64) {
            const wantsPDF = /pdf/i.test(question);
            const longPDF = wantsPDF && (/explain|brief|describe|detail/i.test(question));

            let userContent = question;

            if (file && file.type.includes('image')) {
                const extractedText = await extractTextFromImage(file);
                if (extractedText && extractedText.length > 20) {
                    userContent = `Medical Report Content:\n${extractedText}\n\nProvide wellness insights.`;
                }
            }

            let dynamicInstruction = '';
            if (wantsPDF && longPDF) {
                dynamicInstruction = 'Write a very detailed explanation (800-900 words).';
            } else if (wantsPDF) {
                dynamicInstruction = 'Write a clear, informative explanation.';
            } else {
                dynamicInstruction = 'Answer concisely in 80-120 words.';
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
            return data.choices[0].message.content;
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


        // Initialize app
        init();

        