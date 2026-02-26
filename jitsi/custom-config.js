// EA-Video custom Jitsi Meet configuration
// Appended to Jitsi's config.js at container startup

// Enable E2EE option
config.e2ee = config.e2ee || {};
config.e2ee.e2eeLabels = {
    labelToolTip: 'End-to-end encrypted',
    description: 'This consultation is end-to-end encrypted for patient privacy.',
    label: 'Encrypted',
    warning: 'E2EE requires a compatible browser (Chrome/Edge).'
};
config.e2ee.externallyManagedKey = false;

// Disable pre-join page (users join via JWT URL directly)
config.prejoinConfig = {
    enabled: false
};

// P2P mode for 1:1 consultations (lower latency)
config.p2p = config.p2p || {};
config.p2p.enabled = true;

// Branding
config.localSubject = 'EA-Video Medical Consultation';

// Disable deep linking (stay in browser)
config.disableDeepLinking = true;

// Disable welcome page — prevents unauthorized meeting creation
// Users who visit the root URL will see a blank page instead of the room creation form
config.enableWelcomePage = false;
