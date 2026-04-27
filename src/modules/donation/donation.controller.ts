import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { DonationService } from './donation.service';

const createDonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await DonationService.createDonation(userId, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Donation created successfully.',
    data: result,
  });
});

const getMyDonations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await DonationService.getMyDonations(userId, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Donations fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getDonationsForAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['userId', 'username', 'date', 'paymentStatus', 'provider']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await DonationService.getDonationsForAdmin(filters, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Donation list fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const result = await DonationService.processStripeWebhook(
    rawBody,
    Array.isArray(signature) ? signature[0] : signature
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result,
  });
});

const appleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await DonationService.processAppleWebhook(
    req.headers as Record<string, string | string[] | undefined>,
    req.body as Record<string, unknown>
  );
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result,
  });
});

const googleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await DonationService.processGoogleWebhook(
    req.headers as Record<string, string | string[] | undefined>,
    req.body as Record<string, unknown>
  );
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result,
  });
});


export const DonationController = {
  createDonation,
  getMyDonations,
  getDonationsForAdmin,
  stripeWebhook,
  appleWebhook,
  googleWebhook,
};
