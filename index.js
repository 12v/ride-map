const scopes = ['read_all', 'activity:read_all'];
const clientId = '122479';

function getAccessToken() {
    const expiryDate = localStorage.getItem('expiry_date');
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && expiryDate && Date.now() < expiryDate) {
        return localStorage.getItem('access_token');
    } else {
        var modal = document.getElementById("myModal");
        var btn = document.getElementById("stravaButton");
        btn.onclick = function () {
            window.location.href = `https://www.strava.com/oauth/mobile/authorize?client_id=${clientId}&response_type=code&redirect_uri=${window.location.origin + window.location.pathname}&approval_prompt=auto&scope=${scopes.join(',')}`;
        }
        modal.style.display = "block";
    }
}

async function fetchWithAccessToken(url) {
    let firstAttempt = true;

    function internal() {
        return fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + getAccessToken()
            }
        })
    }

    const response = await internal();
    if (response.status === 200) {
        return response;
    } else if (response.status === 401 && firstAttempt) {
        firstAttempt = false;
        localStorage.removeItem('access_token');
        localStorage.removeItem('expiry_date');
        return internal();
    } else {
        throw error;
    }
}

function fetchActivities(callback, finalCallback) {
    async function internal(page = 1) {
        const response = await fetchWithAccessToken(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`);
        const data = await response.json();
        if (data.length > 0) {
            internal(page + 1);
            data.forEach(callback);
            finalCallback();
        }
    }

    internal();
}

function showActivities() {
    let hasInteracted = false;

    const map = L.map('map')
        .on('zoomstart', () => hasInteracted = true)
        .on('movestart', () => hasInteracted = true);

    const group = L.featureGroup().addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> | <img src="strava api logos/powered by Strava/pwrdBy_strava_light/api_logo_pwrdBy_strava_horiz_light.png" alt="Powered by Strava" style="vertical-align: bottom; height: 2em;">'
    }).addTo(map);

    const lines = [];
    let clickedLine = null;

    fetchActivities(
        activity => {
            if (activity.type === 'Ride') {
                const polyline = activity.map.summary_polyline;
                if (polyline) {
                    const line = L.Polyline.fromEncoded(polyline, { weight: 3, color: 'blue' }).addTo(group);
                    lines.push(line);

                    line.on('mouseover', function () {
                        if (this !== clickedLine) {
                            this.setStyle({
                                color: 'red'
                            });
                        }
                    });

                    line.on('mouseout', function () {
                        console.log(this);
                        console.log(clickedLine);
                        if (this !== clickedLine) {
                            this.setStyle({
                                color: 'blue'
                            });
                        }
                    });

                    line.on('click', function () {
                        this.setStyle({
                            color: 'green'
                        });

                        clickedLine = this;

                        lines.filter(l => l !== clickedLine)
                            .forEach(l => l.setStyle({
                                color: 'blue'
                            }));
                    });

                    const date = new Date(activity.start_date_local);
                    const dateString = date.toLocaleDateString();

                    line.bindPopup(`<div class="centered-popup">${activity.name}<br>${dateString}<br><a target="_blank" rel="noreferrer" href="https://www.strava.com/activities/${activity.id}">View on Strava</a></div>`);
                }
            }
        },
        () => !hasInteracted && map.fitBounds(group.getBounds()));
}

async function handleTokenExchange() {
    const urlParams = new URLSearchParams(window.location.search);
    const grantedScopes = urlParams.get('scope').split(',');

    if (!scopes.every(scope => grantedScopes.includes(scope))) {
        console.error('The user did not grant all the required scopes.');
    } else {
        const code = urlParams.get('code');

        const response = await fetch(`https://strava-token-exchanger.12v.workers.dev/${code}`, {
            mode: 'cors',
        });
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('expiry_date', data.expires_at * 1000);
    }
}

async function init() {
    if (window.location.search !== '') {
        await handleTokenExchange();
        history.replaceState({}, document.title, window.location.pathname);
    }

    showActivities();
}

init();
