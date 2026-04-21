// --- TAB NAVIGATION LOGIC ---
function openTab(evt, tabName) {
    // Hide all tab content
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Remove "active" class from all tab buttons
    const tablinks = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    // If History tab is opened, refresh the data
    if (tabName === 'historyTab') {
        loadHistory();
    }
}

// --- EMAIL MAPPING DICTIONARY ---
const emailMapping = {
    "DILLI": "dilli.d@precifast.in",
    "UMA MAHESH": "maintenance@precifast.in",
    "RAJESH": "e.rajesh@precifast.in",
    "MANOHAR": "prod@precifast.in",
    "TRIPATHI": "prod@precifast.in", 
    "QA-BALA": "sqa@precifast.in", 
    "BALA": "balakrishna.b@precifast.in",
    "DESIGN/NPD": "parandama@precifast.in" // Update this placeholder if needed
};

// --- SET TODAY'S DATE ON LOAD ---
document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    
    // Initial load of history in the background
    loadHistory(); 
});

function getSelectedValues(selectId) {
    const select = document.getElementById(selectId);
    return Array.from(select.selectedOptions).map(option => option.value);
}

// --- AUTO-FILL EMAILS ON SELECTION CHANGE ---
document.getElementById('resp').addEventListener('change', function() {
    const selectedPersons = getSelectedValues('resp');
    
    const emails = selectedPersons
        .map(person => emailMapping[person])
        .filter(email => email !== undefined);
    
    document.getElementById('email').value = emails.join(', ');
});

// --- FETCH & RENDER HISTORY ---
function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split('T')[0];
}

async function loadHistory() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        const tbody = document.getElementById('historyBody');
        tbody.innerHTML = ''; 

        tasks.forEach((task, index) => {
            const row = document.createElement('tr');
            
            // Format Acknowledgment status
            let ackStatus = task.acknowledged ? 
                '<span style="color:#003366; font-size:0.8rem; display:block; margin-top:5px;">✓ Read, replied OK</span>' : '';

            // Format Attachments as clickable links
            let attachmentLinks = '';
            if (task.attachments && task.attachments.length > 0) {
                attachmentLinks = task.attachments.map((filePath, i) => 
                    `<a href="${filePath}" target="_blank" style="color:var(--primary-blue); font-weight:bold; display:block;">View File ${i+1}</a>`
                ).join('');
            }

            // Format Closure info
            let closureInfo = '';
            if (task.status === 'CLOSED') {
                closureInfo = `
                    <div style="font-size: 0.85rem;">
                        <b>Remarks:</b> ${task.closingRemarks || 'N/A'}<br>
                        ${attachmentLinks}
                    </div>
                `;
            }

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${task.priority || ''}</td>
                <td>${(task.dept || []).join(', ')}</td>
                <td>${formatDate(task.date)}</td>
                <td>${task.mom || ''}</td>
                <td>${task.action || ''}</td>
                <td>${(task.resp || []).join(', ')}</td>
                <td>${formatDate(task.targetDate)}</td>
                <td>
                    <span class="status-${task.status.toLowerCase()}">${task.status}</span>
                    ${task.status === 'OPEN' ? ackStatus : ''}
                </td>
                <td>${closureInfo}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

// --- FORM SUBMISSION LOGIC ---
document.getElementById('taskForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const taskData = {
        dept: getSelectedValues('dept'),       
        priority: document.getElementById('priority').value,
        date: document.getElementById('date').value,
        targetDate: document.getElementById('targetDate').value,
        resp: getSelectedValues('resp'),       
        email: document.getElementById('email').value, 
        mom: document.getElementById('mom').value,
        action: document.getElementById('action').value
    };

    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = "Sending...";
    statusDiv.style.color = "#003366"; // Theme Blue

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.textContent = "Task recorded. Initial email sent and 3-hour trigger activated.";
            statusDiv.style.color = "#28a745"; // Success Green
            
            document.getElementById('taskForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            
            // Refresh history data in the background
            loadHistory(); 
        } else {
            statusDiv.textContent = "Error: " + result.error;
            statusDiv.style.color = "#dc3545"; // Error Red
        }
    } catch (error) {
        console.error('Error:', error);
        statusDiv.textContent = "Failed to connect to the server.";
        statusDiv.style.color = "#dc3545";
    }
});