// API Client for ArchBoard

const POLL_INTERVAL = 3000; // 3 seconds

async function fetchSystemInfo() {
    try {
        const response = await fetch('/system/info');
        if (!response.ok) throw new Error('Failed to fetch system info');
        return await response.json();
    } catch (error) {
        console.error('Error fetching system info:', error);
        return null;
    }
}

// Format bytes to human readable (GB)
function formatBytes(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1) + 'G';
}

async function updateDashboardStats() {
    const data = await fetchSystemInfo();
    if (!data) return;

    // Update CPU card
    const cpuValue = document.getElementById('stat-cpu-value');
    const cpuBar = document.getElementById('stat-cpu-bar');
    if (cpuValue) cpuValue.textContent = `${Math.round(data.overall_cpu_usage)}%`;
    if (cpuBar) cpuBar.style.width = `${data.overall_cpu_usage}%`;

    // Update Memory card
    const memValue = document.getElementById('stat-memory-value');
    const memBar = document.getElementById('stat-memory-bar');
    if (memValue) memValue.textContent = `${Math.round(data.memory_usage)}%`;
    if (memBar) memBar.style.width = `${data.memory_usage}%`;

    // Update Disk card - now with used/total (free) format
    const disk = data.disk_usage;
    const diskValue = document.getElementById('stat-disk-value');
    const diskDetails = document.getElementById('stat-disk-details');
    const diskBar = document.getElementById('stat-disk-bar');

    if (diskValue) diskValue.textContent = `${Math.round(disk.percent)}%`;
    if (diskDetails) {
        diskDetails.textContent = `${formatBytes(disk.used)} / ${formatBytes(disk.total)} (${formatBytes(disk.free)} free)`;
    }
    if (diskBar) diskBar.style.width = `${disk.percent}%`;
}

// Start polling on page load
if (window.location.pathname == "/" || window.location.pathname == "/system") {
    document.addEventListener('DOMContentLoaded', () => {
        updateDashboardStats();
        setInterval(updateDashboardStats, POLL_INTERVAL);
    });
}
