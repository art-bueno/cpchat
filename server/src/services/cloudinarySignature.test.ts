import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signCloudinaryParams } from './cloudinarySignature.js';

describe('signCloudinaryParams', () => {
  it('confere com o exemplo da documentação do Cloudinary', () => {
    // https://cloudinary.com/documentation/authentication_signatures
    const params = { timestamp: '1315060510', public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' };
    assert.equal(signCloudinaryParams(params, 'abcd'), 'bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});
