/**
 * Automated Verification Script for Voice Alert Subsystem
 * Tests:
 * 1. Severity filter (HIGH vs MEDIUM/LOW)
 * 2. Mute/Unmute state & cancellations
 * 3. Tactical concise text formatter
 * 4. Queue anti-stacking and rate-limiting
 * 5. Event burst handling (no garbling/overlap)
 */

// Mock browser window and SpeechSynthesis
class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.lang = 'en-US';
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.onend = null;
    this.onerror = null;
  }
}

class MockSpeechSynthesis {
  constructor() {
    this.speaking = false;
    this.pending = false;
    this.paused = false;
    this.spokenLog = [];
    this.currentUtterance = null;
  }

  getVoices() {
    return [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft David', lang: 'en-US' },
    ];
  }

  speak(utterance) {
    this.spokenLog.push({
      text: utterance.text,
      timestamp: Date.now(),
    });
    this.speaking = true;
    this.currentUtterance = utterance;

    // Simulate speech finishing asynchronously
    setTimeout(() => {
      this.speaking = false;
      this.currentUtterance = null;
      if (typeof utterance.onend === 'function') {
        utterance.onend({ type: 'end' });
      }
    }, 100);
  }

  cancel() {
    this.speaking = false;
    this.currentUtterance = null;
  }
}

// Set up global environment
global.window = {
  speechSynthesis: new MockSpeechSynthesis(),
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
global.localStorage = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, val) { this._store[key] = String(val); },
};

async function runTests() {
  console.log('====================================================');
  console.log('IBVAP Voice Alert Subsystem Automated Verification');
  console.log('====================================================\n');

  const { voiceAlertService } = await import('./src/services/voiceAlertService.js');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // --- Test 1: Tactical Concise Text Formatter ---
  console.log('--- Test Group 1: Tactical Phrasing Formatter ---');
  {
    const eventPerson = {
      event_type: 'zone_entry',
      object_class: 'person',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
      severity: 'high',
      confidence: 0.94,
    };
    const textPerson = voiceAlertService.formatSpokenAlert(eventPerson);
    assert(
      textPerson === 'Unknown person detected in area.' && !textPerson.includes('94%'),
      'Person intrusion formats as: Unknown person detected in area.'
    );

    const eventVehicle = {
      event_type: 'zone_entry',
      object_class: 'car',
      camera_id: 'CAM_01',
      severity: 'high',
    };
    const textVehicle = voiceAlertService.formatSpokenAlert(eventVehicle);
    assert(
      textVehicle === 'Unknown vehicle detected in area.',
      'Vehicle intrusion formats as: Unknown vehicle detected in area.'
    );

    // Watchlist match (Capt Rajesh Kumar)
    const eventWatchlistCapt = {
      event_type: 'zone_entry',
      object_class: 'person',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
      identified_as: 'Capt Rajesh Kumar',
      identification_confidence: 0.95,
      severity: 'low',
    };
    const textWatchlistCapt = voiceAlertService.formatSpokenAlert(eventWatchlistCapt);
    assert(
      textWatchlistCapt === 'Watchlist match: Capt Rajesh Kumar detected in area.',
      'Watchlist detection formats as: Watchlist match: Capt Rajesh Kumar detected in area.'
    );

    // Watchlist match (Wanted Suspect)
    const eventWatchlistSuspect = {
      event_type: 'zone_entry',
      object_class: 'person',
      camera_id: 'CAM_02',
      identified_as: 'Wanted Suspect #402',
      severity: 'high',
    };
    const textWatchlistSuspect = voiceAlertService.formatSpokenAlert(eventWatchlistSuspect);
    assert(
      textWatchlistSuspect === 'Watchlist match: Wanted Suspect #402 detected in area.',
      'Watchlist detection formats as: Watchlist match: Wanted Suspect #402 detected in area.'
    );

    // Authorized Vehicle -> MUST BE SILENT (null)
    const eventAuthVeh = {
      event_type: 'zone_entry',
      object_class: 'car',
      camera_id: 'CAM_01',
      plate_number: 'JK02AB1234',
      is_authorized_vehicle: true,
      identified_as: 'Patrol Vehicle Unit 1',
      severity: 'low',
    };
    const textAuthVeh = voiceAlertService.formatSpokenAlert(eventAuthVeh);
    assert(
      textAuthVeh === null,
      'Authorized vehicle is SILENT (formatSpokenAlert returns null)'
    );

    // Authorized Person -> MUST BE SILENT (null)
    const eventAuthPerson = {
      event_type: 'authorized_person',
      object_class: 'person',
      camera_id: 'CAM_01',
      is_authorized_person: true,
      severity: 'low',
    };
    const textAuthPerson = voiceAlertService.formatSpokenAlert(eventAuthPerson);
    assert(
      textAuthPerson === null,
      'Authorized person is SILENT (formatSpokenAlert returns null)'
    );

    const eventLoiter = {
      event_type: 'suspicious_loitering',
      object_class: 'person',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
      severity: 'high',
    };
    const textLoiter = voiceAlertService.formatSpokenAlert(eventLoiter);
    assert(
      textLoiter.includes('Suspicious loitering detected near Sector 4 Gate'),
      'Suspicious loitering anomaly formats tactical warning'
    );

    const eventPacing = {
      event_type: 'suspicious_pacing',
      object_class: 'person',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
      severity: 'high',
    };
    const textPacing = voiceAlertService.formatSpokenAlert(eventPacing);
    assert(
      textPacing.includes('Suspicious pacing behavior detected near Sector 4 Gate'),
      'Suspicious pacing anomaly formats tactical warning'
    );
  }

  // --- Test 2: Severity & Priority Filtering ---
  console.log('\n--- Test Group 2: Severity & Threat Filtering ---');
  {
    window.speechSynthesis.spokenLog = [];
    voiceAlertService.setMuted(false);
    voiceAlertService.lastSpokenTimestamp = 0;

    // Authorized vehicle MUST NOT trigger speech announcement
    voiceAlertService.announceEvent({
      event_id: 'ev-auth-veh-1',
      event_type: 'zone_entry',
      object_class: 'car',
      is_authorized_vehicle: true,
      severity: 'low',
      camera_id: 'CAM_01',
    });
    assert(window.speechSynthesis.spokenLog.length === 0, 'Authorized vehicle does NOT trigger speech');

    // Authorized person MUST NOT trigger speech announcement
    voiceAlertService.announceEvent({
      event_id: 'ev-auth-person-1',
      event_type: 'authorized_person',
      object_class: 'person',
      is_authorized_person: true,
      severity: 'low',
      camera_id: 'CAM_01',
    });
    assert(window.speechSynthesis.spokenLog.length === 0, 'Authorized person does NOT trigger speech');

    // Routine LOW severity event (Zone Exit)
    voiceAlertService.announceEvent({
      event_id: 'ev-low-1',
      event_type: 'zone_exit',
      object_class: 'person',
      severity: 'low',
      camera_id: 'CAM_01',
    });
    assert(window.speechSynthesis.spokenLog.length === 0, 'Routine LOW severity event does NOT trigger speech');

    // Watchlist match (Capt Rajesh Kumar) triggers speech even if backend logged as low
    voiceAlertService.announceEvent({
      event_id: 'ev-wl-capt',
      event_type: 'zone_entry',
      object_class: 'person',
      identified_as: 'Capt Rajesh Kumar',
      severity: 'low',
      camera_id: 'CAM_01',
    });
    assert(
      window.speechSynthesis.spokenLog.length === 1 &&
      window.speechSynthesis.spokenLog[0].text === 'Watchlist match: Capt Rajesh Kumar detected in area.',
      'Watchlist profile (Capt Rajesh Kumar) triggers exact tactical voice alert'
    );

    // Reset log and active speaking state for next test
    window.speechSynthesis.spokenLog = [];
    voiceAlertService.cancelAll();
    voiceAlertService.lastSpokenTimestamp = 0;

    // HIGH severity event (Unknown Person Intrusion)
    voiceAlertService.announceEvent({
      event_id: 'ev-high-1',
      event_type: 'unauthorized_person',
      object_class: 'person',
      severity: 'high',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
    });
    assert(
      window.speechSynthesis.spokenLog.length === 1 &&
      window.speechSynthesis.spokenLog[0].text === 'Unknown person detected in area.',
      'Unknown person intrusion triggers: Unknown person detected in area.'
    );

    // Reset log and active speaking state for next test
    window.speechSynthesis.spokenLog = [];
    voiceAlertService.cancelAll();
    voiceAlertService.lastSpokenTimestamp = 0;

    // HIGH severity event (Unknown Vehicle Intrusion)
    voiceAlertService.announceEvent({
      event_id: 'ev-high-veh-1',
      event_type: 'unauthorized_vehicle',
      object_class: 'car',
      severity: 'high',
      camera_id: 'CAM_01',
    });
    assert(
      window.speechSynthesis.spokenLog.length === 1 &&
      window.speechSynthesis.spokenLog[0].text === 'Unknown vehicle detected in area.',
      'Unknown vehicle intrusion triggers: Unknown vehicle detected in area.'
    );
  }

  // --- Test 3: Mute & Unmute Toggle ---
  console.log('\n--- Test Group 3: Mute & Unmute Controls ---');
  {
    window.speechSynthesis.spokenLog = [];
    voiceAlertService.setMuted(true);
    assert(voiceAlertService.isMuted() === true, 'Mute state is active');

    // Attempt announcing high severity while muted
    voiceAlertService.announceEvent({
      event_id: 'ev-high-muted',
      event_type: 'zone_entry',
      object_class: 'person',
      severity: 'high',
      camera_id: 'CAM_01',
    });
    assert(window.speechSynthesis.spokenLog.length === 0, 'No speech occurs while muted');

    // Unmute
    voiceAlertService.setMuted(false);
    assert(voiceAlertService.isMuted() === false, 'Unmute restores audio alerts');

    voiceAlertService.lastSpokenTimestamp = 0; // Reset rate-limit timer for immediate test assertion
    voiceAlertService.announceEvent({
      event_id: 'ev-high-unmuted',
      event_type: 'zone_entry',
      object_class: 'person',
      severity: 'high',
      camera_id: 'CAM_01',
      camera_name: 'Sector 4 Gate',
    });
    assert(window.speechSynthesis.spokenLog.length === 1, 'Speech triggers immediately after unmuting');
  }

  // --- Test 4: Anti-Stacking & Rapid Burst Protection ---
  console.log('\n--- Test Group 4: Anti-Stacking & Queue Burst Safeguards ---');
  {
    window.speechSynthesis.spokenLog = [];
    voiceAlertService.cancelAll();
    voiceAlertService.minIntervalMs = 0; // Test queue capacity for test run

    // Send 10 rapid events simultaneously
    for (let i = 1; i <= 10; i++) {
      voiceAlertService.announceEvent({
        event_id: `ev-burst-${i}`,
        event_type: 'zone_entry',
        object_class: 'person',
        severity: 'high',
        camera_id: 'CAM_01',
        camera_name: `Sector 4 Gate - Track #${i}`,
      });
    }

    // Queue depth should be capped at maxQueueDepth (2)
    assert(
      voiceAlertService.speechQueue.length <= 2,
      `Queue size (${voiceAlertService.speechQueue.length}) is capped at <= 2 to prevent audio lag`
    );
  }

  console.log('\n====================================================');
  console.log(`Results: ${passedTests}/${totalTests} Tests Passed successfully.`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
