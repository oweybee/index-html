import axios from 'axios';

const BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

function headers() {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY must be set');
  return {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io',
  };
}

// FIFA World Cup 2026 IDs in API-Football
export const WORLD_CUP = { leagueId: 1, season: 2026 };

export interface ApiFootballFixture {
  fixtureId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  kickoffAt: Date;
  statusShort: string;
}

export async function getUpcomingFixtures(
  leagueId: number,
  season: number,
  next = 50
): Promise<ApiFootballFixture[]> {
  const res = await axios.get(`${BASE_URL}/fixtures`, {
    headers: headers(),
    params: { league: leagueId, season, next },
  });

  return (res.data.response ?? []).map((item: any) => ({
    fixtureId: item.fixture.id,
    homeTeam: { id: item.teams.home.id, name: item.teams.home.name },
    awayTeam: { id: item.teams.away.id, name: item.teams.away.name },
    kickoffAt: new Date(item.fixture.date),
    statusShort: item.fixture.status.short,
  }));
}

export interface MatchPrediction {
  fixtureId: number;
  winnerTeam: string | null;
  winnerComment: string;
  underOver: string | null;
  goalsHome: string;
  goalsAway: string;
  advice: string;
  pctHome: string;
  pctDraw: string;
  pctAway: string;
}

export async function getPredictions(fixtureId: number): Promise<MatchPrediction | null> {
  const res = await axios.get(`${BASE_URL}/predictions`, {
    headers: headers(),
    params: { fixture: fixtureId },
  });

  const item = res.data.response?.[0];
  if (!item) return null;

  return {
    fixtureId,
    winnerTeam: item.predictions.winner?.name ?? null,
    winnerComment: item.predictions.winner?.comment ?? '',
    underOver: item.predictions.under_over ?? null,
    goalsHome: item.predictions.goals?.home ?? '',
    goalsAway: item.predictions.goals?.away ?? '',
    advice: item.predictions.advice ?? '',
    pctHome: item.predictions.percent?.home ?? '',
    pctDraw: item.predictions.percent?.draw ?? '',
    pctAway: item.predictions.percent?.away ?? '',
  };
}

export interface TeamStats {
  teamId: number;
  teamName: string;
  form: string;
  cleanSheetHome: number;
  cleanSheetAway: number;
  cleanSheetTotal: number;
  failedToScoreHome: number;
  failedToScoreAway: number;
  failedToScoreTotal: number;
  avgGoalsForHome: number;
  avgGoalsForAway: number;
  avgGoalsAgainstHome: number;
  avgGoalsAgainstAway: number;
}

export async function getTeamStats(
  leagueId: number,
  season: number,
  teamId: number
): Promise<TeamStats | null> {
  const res = await axios.get(`${BASE_URL}/teams/statistics`, {
    headers: headers(),
    params: { league: leagueId, season, team: teamId },
  });

  const s = res.data.response;
  if (!s?.team) return null;

  return {
    teamId: s.team.id,
    teamName: s.team.name,
    form: s.form ?? '',
    cleanSheetHome: s.clean_sheet?.home ?? 0,
    cleanSheetAway: s.clean_sheet?.away ?? 0,
    cleanSheetTotal: s.clean_sheet?.total ?? 0,
    failedToScoreHome: s.failed_to_score?.home ?? 0,
    failedToScoreAway: s.failed_to_score?.away ?? 0,
    failedToScoreTotal: s.failed_to_score?.total ?? 0,
    avgGoalsForHome: parseFloat(s.goals?.for?.average?.home ?? '0'),
    avgGoalsForAway: parseFloat(s.goals?.for?.average?.away ?? '0'),
    avgGoalsAgainstHome: parseFloat(s.goals?.against?.average?.home ?? '0'),
    avgGoalsAgainstAway: parseFloat(s.goals?.against?.average?.away ?? '0'),
  };
}

export interface LineupPlayer {
  playerId: number;
  name: string;
  number: number;
  position: string;
  grid: string | null;
}

export interface FixtureLineup {
  teamId: number;
  teamName: string;
  formation: string;
  startingXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export async function getLineups(fixtureId: number): Promise<FixtureLineup[]> {
  const res = await axios.get(`${BASE_URL}/fixtures/lineups`, {
    headers: headers(),
    params: { fixture: fixtureId },
  });

  return (res.data.response ?? []).map((team: any) => ({
    teamId: team.team.id,
    teamName: team.team.name,
    formation: team.formation ?? '',
    startingXI: (team.startXI ?? []).map((p: any) => ({
      playerId: p.player.id,
      name: p.player.name,
      number: p.player.number,
      position: p.player.pos,
      grid: p.player.grid ?? null,
    })),
    substitutes: (team.substitutes ?? []).map((p: any) => ({
      playerId: p.player.id,
      name: p.player.name,
      number: p.player.number,
      position: p.player.pos,
      grid: p.player.grid ?? null,
    })),
  }));
}
