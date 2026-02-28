import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import MapComponent from './components/MapComponent';
import Scrubber from './components/Scrubber';
import ChatInterface from './components/ChatInterface';
import SectorPanel from './components/SectorPanel';
import DetailDrawer from './components/DetailDrawer';
import TrajectoryChart from './components/TrajectoryChart';
import CarbonPriceChart from './components/CarbonPriceChart';
import MarketSnapshot from './components/MarketSnapshot';
import AgentExplorer from './components/AgentExplorer';
import AgentActivity from './components/AgentActivity';
import ScenarioLibrary from './components/ScenarioLibrary';
import { projectEmissions, ETS_CAP } from './utils/projection';
import { getArchetype } from './utils/archetypes';
import { runQuarter } from './utils/simulationEngine';
import { loadScenarioLibrary, removeScenarioFromLibrary } from './utils/scenarioEngine';

// Hardcoded Data (Keep for background map layer)
const emissionsData = {
  DE: { 2008: 488, 2009: 420, 2010: 451, 2011: 445, 2012: 432, 2013: 441, 2014: 415, 2015: 403, 2016: 390, 2017: 385, 2018: 358, 2019: 311, 2020: 253, 2021: 268, 2022: 271, 2023: 208, 2024: 278 },
  FR: { 2008: 131, 2009: 113, 2010: 122, 2011: 120, 2012: 116, 2013: 115, 2014: 106, 2015: 104, 2016: 101, 2017: 103, 2018: 98, 2019: 89, 2020: 71, 2021: 78, 2022: 75, 2023: 58, 2024: 49 },
  PL: { 2008: 209, 2009: 184, 2010: 196, 2011: 196, 2012: 197, 2013: 197, 2014: 190, 2015: 188, 2016: 188, 2017: 191, 2018: 189, 2019: 179, 2020: 155, 2021: 155, 2022: 157, 2023: 122, 2024: 76 },
  ES: { 2008: 168, 2009: 137, 2010: 140, 2011: 130, 2012: 119, 2013: 120, 2014: 114, 2015: 118, 2016: 113, 2017: 115, 2018: 106, 2019: 98, 2020: 80, 2021: 88, 2022: 86, 2023: 73, 2024: 89 },
  IT: { 2008: 196, 2009: 163, 2010: 172, 2011: 164, 2012: 153, 2013: 147, 2014: 135, 2015: 136, 2016: 132, 2017: 135, 2018: 130, 2019: 122, 2020: 101, 2021: 111, 2022: 109, 2023: 91, 2024: 113 },
  GB: { 2008: 279, 2009: 237, 2010: 243, 2011: 234, 2012: 247, 2013: 253, 2014: 224, 2015: 207, 2016: 183, 2017: 170, 2018: 155, 2019: 131, 2020: 103, 2021: 107, 2022: 100, 2023: 76, 2024: 62 },
  NL: { 2008: 89, 2009: 77, 2010: 84, 2011: 83, 2012: 82, 2013: 83, 2014: 79, 2015: 79, 2016: 78, 2017: 80, 2018: 77, 2019: 70, 2020: 59, 2021: 63, 2022: 64, 2023: 54, 2024: 64 },
  CZ: { 2008: 90, 2009: 77, 2010: 82, 2011: 79, 2012: 76, 2013: 75, 2014: 68, 2015: 67, 2016: 65, 2017: 65, 2018: 61, 2019: 55, 2020: 47, 2021: 51, 2022: 51, 2023: 42, 2024: 40 },
  GR: { 2008: 73, 2009: 66, 2010: 69, 2011: 67, 2012: 59, 2013: 57, 2014: 52, 2015: 51, 2016: 48, 2017: 47, 2018: 45, 2019: 37, 2020: 29, 2021: 32, 2022: 30, 2023: 23, 2024: 37 },
  BE: { 2008: 62, 2009: 51, 2010: 56, 2011: 54, 2012: 51, 2013: 50, 2014: 47, 2015: 46, 2016: 45, 2017: 46, 2018: 44, 2019: 42, 2020: 35, 2021: 40, 2022: 39, 2023: 33, 2024: 34 },
  SE: { 2008: 24, 2009: 19, 2010: 22, 2011: 21, 2012: 19, 2013: 18, 2014: 17, 2015: 16, 2016: 16, 2017: 16, 2018: 15, 2019: 14, 2020: 11, 2021: 13, 2022: 13, 2023: 11, 2024: 10 },
  FI: { 2008: 37, 2009: 28, 2010: 35, 2011: 35, 2012: 31, 2013: 28, 2014: 26, 2015: 24, 2016: 22, 2017: 21, 2018: 19, 2019: 17, 2020: 14, 2021: 16, 2022: 14, 2023: 11, 2024: 9 },
  RO: { 2008: 73, 2009: 55, 2010: 56, 2011: 54, 2012: 51, 2013: 53, 2014: 47, 2015: 48, 2016: 46, 2017: 48, 2018: 45, 2019: 40, 2020: 31, 2021: 33, 2022: 33, 2023: 25, 2024: 20 },
  AT: { 2008: 35, 2009: 28, 2010: 31, 2011: 30, 2012: 28, 2013: 27, 2014: 25, 2015: 25, 2016: 24, 2017: 24, 2018: 23, 2019: 22, 2020: 17, 2021: 20, 2022: 20, 2023: 17, 2024: 27 },
  PT: { 2008: 36, 2009: 27, 2010: 27, 2011: 24, 2012: 21, 2013: 22, 2014: 21, 2015: 23, 2016: 22, 2017: 24, 2018: 22, 2019: 19, 2020: 14, 2021: 17, 2022: 16, 2023: 13, 2024: 11 },
};

const countryCentroids = {
  DE: [10.4515, 51.1657], FR: [2.2137, 46.2276], PL: [19.1451, 51.9194],
  ES: [-3.7492, 40.4637], IT: [12.5674, 41.8719], GB: [-3.4360, 55.3781],
  NL: [5.2913, 52.1326], CZ: [15.4730, 49.8175], GR: [21.8243, 39.0742],
  BE: [4.4699, 50.5039], SE: [18.6435, 60.1282], FI: [25.7482, 61.9241],
  RO: [24.9668, 45.9432], AT: [14.5501, 47.5162], PT: [-8.2245, 39.3999],
};

function App() {
  const [currentYear, setCurrentYear] = useState(2008);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [installationsData, setInstallationsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Setup detailed data states
  const [activeSectors, setActiveSectors] = useState(new Set());
  const [selectedInstallation, setSelectedInstallation] = useState(null);

  // Personality state (Step 5)
  const [personalities, setPersonalities] = useState(null);
  const [personalitiesLoading, setPersonalitiesLoading] = useState(false);
  const [agentActivityLog, setAgentActivityLog] = useState([]);

  // Scenario state (Step 6)
  const [activeScenarios, setActiveScenarios] = useState([]);
  const [scenarioLibrary, setScenarioLibrary] = useState(() => loadScenarioLibrary());

  // Simulation state
  const [simulation, setSimulation] = useState({
    running: false,
    currentYear: 2025,
    currentQuarter: 1,
    carbonPrice: 65.0,
    priceHistory: [
      { year: 2020, q: 1, price: 24.0 },
      { year: 2020, q: 2, price: 22.0 },
      { year: 2020, q: 3, price: 27.0 },
      { year: 2020, q: 4, price: 30.0 },
      { year: 2021, q: 1, price: 37.0 },
      { year: 2021, q: 2, price: 52.0 },
      { year: 2021, q: 3, price: 58.0 },
      { year: 2021, q: 4, price: 68.0 },
      { year: 2022, q: 1, price: 78.0 },
      { year: 2022, q: 2, price: 85.0 },
      { year: 2022, q: 3, price: 70.0 },
      { year: 2022, q: 4, price: 75.0 },
      { year: 2023, q: 1, price: 95.0 },
      { year: 2023, q: 2, price: 87.0 },
      { year: 2023, q: 3, price: 82.0 },
      { year: 2023, q: 4, price: 70.0 },
      { year: 2024, q: 1, price: 62.0 },
      { year: 2024, q: 2, price: 68.0 },
      { year: 2024, q: 3, price: 64.0 },
      { year: 2024, q: 4, price: 65.0 },
    ],
    agentStates: {},
    lastQuarterDemand: 0,
    lastQuarterSupply: 0
  });

  // Load installations data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/installations.json');
        const data = await response.json();

        // Compute projections once on load
        const installationsWithProjection = data.map(inst => ({
          ...inst,
          p: projectEmissions(inst.e), // p = projected array, 6 values for 2025–2030
          archetype: getArchetype(inst.e) // Add archetype classification
        }));

        setInstallationsData(installationsWithProjection);

        // Initialize agent states for simulation
        const newAgentStates = {};
        installationsWithProjection.forEach(inst => {
          if (inst.archetype !== 'inactive') {
            newAgentStates[inst.id] = {
              creditsHeld: 0,
              projectedAnnual: inst.p ? inst.p[0] : 0, // projected emissions for 2025
              ytdEmissions: 0,
              coverageRatio: 0,
              shortfall: 0,
              lastPurchase: null,
            };
          }
        });

        // Initialize App.jsx simulation root state
        setSimulation(prev => ({
          ...prev,
          agentStates: newAgentStates
        }));

        // Extract unique sectors
        const sectorsSet = new Set();
        installationsWithProjection.forEach(inst => sectorsSet.add(inst.s));
        setActiveSectors(sectorsSet);

        // Load cached personalities from localStorage
        const cached = localStorage.getItem('co2nvergence_personalities_v1');
        if (cached) {
          try {
            setPersonalities(JSON.parse(cached));
          } catch (e) {
            console.warn('Invalid cached personalities, clearing');
            localStorage.removeItem('co2nvergence_personalities_v1');
          }
        }
      } catch (err) {
        console.error("Failed to load installations data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Compute sector counts (static)
  const sectorCounts = useMemo(() => {
    const counts = {};
    installationsData.forEach(inst => {
      counts[inst.s] = (counts[inst.s] || 0) + 1;
    });
    // Sort logic from highest count to lowest
    return Object.fromEntries(
      Object.entries(counts).sort(([, a], [, b]) => b - a)
    );
  }, [installationsData]);

  // Compute totals
  const { visibleCount, totalVisible, sectorTotals, countryTotals } = useMemo(() => {
    let _visibleCount = 0;
    let _totalVisible = 0;
    const _sectorTotals = {};
    const _countryTotals = {};
    const isProj = currentYear > 2024;

    installationsData.forEach(inst => {
      if (activeSectors.has(inst.s)) {
        const yearVal = isProj
          ? (inst.p ? inst.p[currentYear - 2025] : 0) || 0
          : inst.e[currentYear - 2008] || 0;
        if (yearVal > 0) {
          _visibleCount++;
          _totalVisible += yearVal;
          _sectorTotals[inst.s] = (_sectorTotals[inst.s] || 0) + yearVal;
          _countryTotals[inst.c] = (_countryTotals[inst.c] || 0) + yearVal;
        }
      }
    });

    return {
      visibleCount: _visibleCount,
      totalVisible: _totalVisible,
      sectorTotals: _sectorTotals,
      countryTotals: _countryTotals
    };
  }, [installationsData, currentYear, activeSectors]);

  // Derive Trajectory Datasets across all years
  const { historicalTotals, projectedTotals } = useMemo(() => {
    const hist = {};
    const proj = {};

    // Initialize years
    for (let y = 2008; y <= 2024; y++) hist[y] = 0;
    for (let y = 2025; y <= 2030; y++) proj[y] = 0;

    installationsData.forEach(inst => {
      if (activeSectors.has(inst.s)) {
        // Hist
        inst.e.forEach((val, i) => {
          if (val > 0) hist[2008 + i] += val;
        });
        // Proj
        if (inst.p) {
          inst.p.forEach((val, i) => {
            if (val > 0) proj[2025 + i] += val;
          });
        }
      }
    });

    // Convert to Gt for chart
    for (let y in hist) hist[y] = Number((hist[y] / 1e9).toFixed(3));
    for (let y in proj) proj[y] = Number((proj[y] / 1e9).toFixed(3));

    return { historicalTotals: hist, projectedTotals: proj };
  }, [installationsData, activeSectors]);

  const isFiltered = activeSectors.size < Object.keys(sectorCounts).length;
  const isProjected = currentYear > 2024;

  // Compliance Gap Calculation
  const projectedGt = Number((totalVisible / 1e9).toFixed(3));
  const currentCap = ETS_CAP[currentYear];
  const complianceGap = isProjected && currentCap ? projectedGt - currentCap : null;
  const isAboveCap = complianceGap > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--bg-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'var(--text-primary)',
          fontSize: '1.2rem'
        }}>
          <div className="animate-pulse">Loading installation data...</div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        backgroundColor: 'var(--top-bar)',
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          CO<sub>2</sub>nvergence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => setCurrentYear(y => Math.max(2008, y - 1))}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &larr;
          </button>
          <span className="top-bar-year-display" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {isProjected ? `~${currentYear}` : currentYear}
          </span>
          <button
            onClick={() => setCurrentYear(y => Math.min(2030, y + 1))}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &rarr;
          </button>
        </div>
        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFiltered && (
            <span style={{
              backgroundColor: 'var(--accent-amber)',
              color: '#000',
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              Filtered
            </span>
          )}
          <span>
            {isProjected && '~'}{visibleCount.toLocaleString()} installations · {isProjected && '~'}{(totalVisible / 1e9).toFixed(2)} Gt CO₂e {isProjected && '(projected)'}
          </span>
          {isProjected && isAboveCap && (
            <>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span style={{ color: '#F4A261', fontWeight: 'bold' }}>
                ⚠ above cap by {complianceGap.toFixed(2)} Gt
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapComponent
          currentYear={currentYear}
          emissionsData={emissionsData}
          installationsData={installationsData}
          activeSectors={activeSectors}
          onSelectInstallation={setSelectedInstallation}
          simulation={simulation}
        />

        {/* Detail Drawer overlay */}
        <DetailDrawer
          installation={selectedInstallation}
          currentYear={currentYear}
          onClose={() => setSelectedInstallation(null)}
          simulation={simulation}
          personalities={personalities}
        />

        {/* Right Panel: Trajectory + Carbon Price + Market Snapshot */}
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          width: '320px',
          maxHeight: 'calc(100% - 100px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 10
        }}>
          <TrajectoryChart
            currentYear={currentYear}
            historicalTotals={historicalTotals}
            projectedTotals={projectedTotals}
          />
          {currentYear >= 2025 && (
            <>
              <CarbonPriceChart simulation={simulation} />
              <MarketSnapshot simulation={simulation} installationsData={installationsData} />
              {agentActivityLog.length > 0 && (
                <AgentActivity activityLog={agentActivityLog} personalities={personalities} />
              )}
              {(activeScenarios.length > 0 || scenarioLibrary.length > 0) && (
                <ScenarioLibrary
                  activeScenarios={activeScenarios}
                  scenarioLibrary={scenarioLibrary}
                  onRemoveFromLibrary={(id) => {
                    const updated = removeScenarioFromLibrary(id);
                    setScenarioLibrary(updated);
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Sector Panel overlay */}
        {!isLoading && (
          <SectorPanel
            sectorCounts={sectorCounts}
            activeSectors={activeSectors}
            setActiveSectors={setActiveSectors}
          />
        )}

        {/* Agent Explorer (below sector panel, simulation mode only) */}
        {currentYear >= 2025 && personalities && (
          <AgentExplorer
            installationsData={installationsData}
            personalities={personalities}
            simulation={simulation}
            onSelectInstallation={setSelectedInstallation}
          />
        )}
      </div>

      {/* Scrubber Area */}
      <div style={{
        height: '60px',
        backgroundColor: 'var(--surface-dark)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 10
      }}>
        <Scrubber
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          simulation={simulation}
          setSimulation={setSimulation}
          installationsData={installationsData}
          personalities={personalities}
          setPersonalities={setPersonalities}
          personalitiesLoading={personalitiesLoading}
          setPersonalitiesLoading={setPersonalitiesLoading}
          setAgentActivityLog={setAgentActivityLog}
          activeScenarios={activeScenarios}
          setActiveScenarios={setActiveScenarios}
        />
      </div>

      {/* Chat Interface Area */}
      <div style={{
        height: isChatOpen ? '30%' : '60px',
        maxHeight: '30%',
        backgroundColor: 'var(--surface-dark)',
        borderTop: '1px solid var(--border-color)',
        transition: 'height 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10
      }}>
        <ChatInterface
          currentYear={currentYear}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          metrics={{ visibleCount, totalVisible, sectorTotals, countryTotals, activeSectors }}
          simulation={simulation}
          setSimulation={setSimulation}
          installationsData={installationsData}
          emissionsData={emissionsData}
          personalities={personalities}
          activeSectors={activeSectors}
          setActiveSectors={setActiveSectors}
          activeScenarios={activeScenarios}
          setActiveScenarios={setActiveScenarios}
        />
      </div>

    </div>
  );
}

export default App;
