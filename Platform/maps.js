// ===== MAPS WITH DATABASE INTEGRATION =====
import { db } from './database.js'

const maps = {
  // Initialize maps
  async init() {
    await this.initBranchesMap();
  },

  // Initialize branches map with real data
  async initBranchesMap() {
    if (!window.L) {
      setTimeout(() => this.initBranchesMap(), 1000);
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    try {
      // Get branches from database
      const { data: branches, error } = await db.supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading branches:', error);
        return;
      }

      const map = L.map('map', { scrollWheelZoom: false }).setView([23.8859, 45.0792], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18, 
        attribution: '&copy; OpenStreetMap' 
      }).addTo(map);

      // Add branch markers from database
      if (branches && branches.length > 0) {
        branches.forEach(branch => {
          if (branch.lat && branch.long) {
            const marker = L.marker([branch.lat, branch.long]).addTo(map);
            marker.bindPopup(`
              <strong>دكان فيجين — ${branch.name}</strong><br>
              <small>${branch.address}</small><br>
              <small><a href="https://maps.google.com/?q=${branch.lat},${branch.long}" target="_blank">فتح على الخريطة</a></small>
            `);
          }
        });

        // Fit map to show all branches
        const markers = branches
          .filter(branch => branch.lat && branch.long)
          .map(branch => L.marker([branch.lat, branch.long]));
        
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.3));
        }
      } else {
        // Fallback to static branches if database is empty
        const fallbackBranches = [
          { name: 'فرع العليا', lat: 24.711667, long: 46.674722, address: 'طريق الملك فهد، حي العليا، الرياض' },
          { name: 'فرع النرجس', lat: 24.8859, long: 46.6417, address: 'الرياض — حي النرجس' },
          { name: 'فرع الياسمين', lat: 24.836111, long: 46.620278, address: 'طريق أنس بن مالك، حي الياسمين، الرياض' }
        ];

        fallbackBranches.forEach(branch => {
          const marker = L.marker([branch.lat, branch.long]).addTo(map);
          marker.bindPopup(`
            <strong>دكان فيجين — ${branch.name}</strong><br>
            <small>${branch.address}</small><br>
            <small><a href="https://maps.google.com/?q=${branch.lat},${branch.long}" target="_blank">فتح على الخريطة</a></small>
          `);
        });

        const markers = fallbackBranches.map(branch => L.marker([branch.lat, branch.long]));
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.3));
      }
    } catch (error) {
      console.error('Error initializing branches map:', error);
    }
  },

  // Initialize branches map for landing page
  initBranchesMapLanding() {
    if (!window.L) {
      setTimeout(() => this.initBranchesMapLanding(), 1000);
      return;
    }

    const mapElement = document.getElementById('branchesMap');
    if (!mapElement) return;

    const map = L.map('branchesMap', { scrollWheelZoom: false }).setView([23.8859, 45.0792], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      maxZoom: 18, 
      attribution: '&copy; OpenStreetMap' 
    }).addTo(map);

    // Add branch markers
    const branches = [
      { name: 'دكان فيجين — فرع العليا', coords: [24.711667, 46.674722], link: 'https://maps.app.goo.gl/vmbrsYAHRGHsq8ih9' },
      { name: 'دكان فيجين — فرع النرجس', coords: [24.8859, 46.6417], link: 'https://maps.app.goo.gl/nGC34myqDDgVXfHg7' },
      { name: 'دكان فيجين — فرع الياسمين', coords: [24.836111, 46.620278], link: 'https://www.google.com/maps/?q=24.836111,46.620278' }
    ];

    branches.forEach(branch => {
      const marker = L.marker(branch.coords).addTo(map);
      marker.bindTooltip(
        `<strong>${branch.name}</strong><br><small><a href="${branch.link}" target="_blank">فتح على الخريطة</a></small>`,
        { permanent: false, direction: 'top' }
      );
    });

    // Fit map to show all branches
    const group = L.featureGroup(branches.map(b => L.marker(b.coords)));
    map.fitBounds(group.getBounds().pad(0.3));
  },

  // Initialize branches map for dashboard
  initBranchesMapDashboard() {
    if (!window.L) {
      setTimeout(() => this.initBranchesMapDashboard(), 1000);
      return;
    }

    const mapElement = document.getElementById('branchesMapDash');
    if (!mapElement) return;

    const map = L.map('branchesMapDash', { scrollWheelZoom: false }).setView([23.8859, 45.0792], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      maxZoom: 18, 
      attribution: '&copy; OpenStreetMap' 
    }).addTo(map);

    // Add branch markers
    const branches = [
      { name: 'دكان فيجين — فرع العليا', coords: [24.711667, 46.674722], link: 'https://maps.app.goo.gl/vmbrsYAHRGHsq8ih9' },
      { name: 'دكان فيجين — فرع النرجس', coords: [24.8859, 46.6417], link: 'https://maps.app.goo.gl/nGC34myqDDgVXfHg7' },
      { name: 'دكان فيجين — فرع الياسمين', coords: [24.836111, 46.620278], link: 'https://www.google.com/maps/?q=24.836111,46.620278' }
    ];

    branches.forEach(branch => {
      const marker = L.marker(branch.coords).addTo(map);
      marker.bindPopup(`
        <strong>${branch.name}</strong><br>
        <small><a href="${branch.link}" target="_blank">فتح على الخريطة</a></small>
      `);
    });

    // Fit map to show all branches
    const group = L.featureGroup(branches.map(b => L.marker(b.coords)));
    map.fitBounds(group.getBounds().pad(0.3));
  },

  // Get user location
  getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.showNearestBranch(latitude, longitude);
        },
        (error) => {
          console.error('Error getting location:', error);
          this.showToast('لا يمكن تحديد موقعك. يرجى السماح بالوصول للموقع.', 'warning');
        }
      );
    } else {
      this.showToast('متصفحك لا يدعم تحديد الموقع.', 'warning');
    }
  },

  // Show nearest branch
  showNearestBranch(userLat, userLng) {
    const branches = [
      { name: 'دكان فيجين — فرع العليا', coords: [24.711667, 46.674722], link: 'https://maps.app.goo.gl/vmbrsYAHRGHsq8ih9' },
      { name: 'دكان فيجين — فرع النرجس', coords: [24.8859, 46.6417], link: 'https://maps.app.goo.gl/nGC34myqDDgVXfHg7' },
      { name: 'دكان فيجين — فرع الياسمين', coords: [24.836111, 46.620278], link: 'https://www.google.com/maps/?q=24.836111,46.620278' }
    ];

    let nearestBranch = null;
    let shortestDistance = Infinity;

    branches.forEach(branch => {
      const distance = this.calculateDistance(userLat, userLng, branch.coords[0], branch.coords[1]);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestBranch = branch;
      }
    });

    if (nearestBranch) {
      this.showToast(`أقرب فرع لك: ${nearestBranch.name} (${shortestDistance.toFixed(1)} كم)`, 'success');

      // Open Google Maps with directions
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${nearestBranch.coords[0]},${nearestBranch.coords[1]}`;
      window.open(directionsUrl, '_blank');
    }
  },

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  },

  // Convert degrees to radians
  deg2rad(deg) {
    return deg * (Math.PI/180);
  },

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      transition: all 0.3s ease;
    `;

    switch (type) {
      case 'success':
        toast.style.background = '#10b981';
        break;
      case 'error':
        toast.style.background = '#ef4444';
        break;
      case 'warning':
        toast.style.background = '#f59e0b';
        break;
      default:
        toast.style.background = '#3b82f6';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
};

// Global functions for HTML onclick handlers
function findNearestBranch() {
  maps.getUserLocation();
}

function openBranchOnMap(branchName) {
  const branches = {
    'العليا': 'https://maps.app.goo.gl/vmbrsYAHRGHsq8ih9',
    'النرجس': 'https://maps.app.goo.gl/nGC34myqDDgVXfHg7',
    'الياسمين': 'https://www.google.com/maps/?q=24.836111,46.620278'
  };

  const branchKey = Object.keys(branches).find(key => branchName.includes(key));
  if (branchKey) {
    window.open(branches[branchKey], '_blank');
  }
}

// Initialize maps when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  maps.init();
});

// Export for global access
window.maps = maps; 
