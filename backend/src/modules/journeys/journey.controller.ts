import { Request, Response, NextFunction } from 'express';
import * as journeyService from './journey.service.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const startJourney = wrap(async (req, res) => {
  const userId = req.auth!.userId;
  const { routeId, origin, destination, polyline, distance, duration, riskScore } = req.body;
  if (!routeId || !origin || !destination || !polyline) {
    res.status(400).json({ success: false, message: 'routeId, origin, destination, polyline are required' });
    return;
  }
  const journey = await journeyService.startJourney(userId, {
    routeId, origin, destination, polyline, distance, duration, riskScore,
  });
  res.status(201).json({ success: true, data: journey });
});

export const updateLocation = wrap(async (req, res) => {
  const { journeyId, latitude, longitude } = req.body;
  const journey = await journeyService.updateLocation(journeyId, req.auth!.userId, { latitude, longitude });
  if (!journey) { res.status(404).json({ success: false, message: 'Journey not found' }); return; }
  res.json({ success: true, data: journey });
});

export const checkIn = wrap(async (req, res) => {
  const { journeyId, latitude, longitude } = req.body;
  const journey = await journeyService.addCheckIn(journeyId, req.auth!.userId, { latitude, longitude });
  if (!journey) { res.status(404).json({ success: false, message: 'Journey not found' }); return; }
  res.json({ success: true, data: journey });
});

export const reportDeviation = wrap(async (req, res) => {
  const { journeyId, latitude, longitude } = req.body;
  const journey = await journeyService.recordDeviation(journeyId, req.auth!.userId, { latitude, longitude });
  if (!journey) { res.status(404).json({ success: false, message: 'Journey not found' }); return; }
  res.json({ success: true, data: journey });
});

export const finishJourney = wrap(async (req, res) => {
  const { journeyId } = req.body;
  const journey = await journeyService.finishJourney(journeyId, req.auth!.userId);
  if (!journey) { res.status(404).json({ success: false, message: 'Journey not found' }); return; }
  res.json({ success: true, data: journey });
});

export const setOutcome = wrap(async (req, res) => {
  const { journeyId, outcome } = req.body;
  const journey = await journeyService.setOutcome(journeyId, req.auth!.userId, outcome);
  if (!journey) { res.status(404).json({ success: false, message: 'Journey not found' }); return; }
  res.json({ success: true, data: journey });
});

export const getHistory = wrap(async (req, res) => {
  const journeys = await journeyService.getHistory(req.auth!.userId);
  res.json({ success: true, data: journeys });
});

export const getJourneyById = wrap(async (req, res) => {
  const { id } = req.params;

  if (!id || Array.isArray(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid journey ID',
    });
    return;
  }

  const journey = await journeyService.getJourneyById(
    id,
    req.auth!.userId
  );

  if (!journey) {
    res.status(404).json({
      success: false,
      message: 'Journey not found',
    });
    return;
  }

  res.json({ success: true, data: journey });
});

export const getAnalyticsSummary = wrap(async (req, res) => {
  const summary = await journeyService.getAnalyticsSummary(req.auth!.userId);
  res.json({ success: true, data: summary });
});