import { test, expect } from '@playwright/test';

test.describe('Start of Day - Location Permissions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the start of day page
    await page.goto('/driver/start-of-day');
    
    // Fill out required form fields
    await page.fill('[data-testid="parcel-count"]', '50');
    await page.fill('[data-testid="mileage"]', '12345');
    
    // Check all vehicle inspection items
    await page.check('[data-testid="check-lights"]');
    await page.check('[data-testid="check-tyres"]');
    await page.check('[data-testid="check-brakes"]');
    await page.check('[data-testid="check-mirrors"]');
    await page.check('[data-testid="check-fuel"]');
    await page.check('[data-testid="check-cleanliness"]');
    await page.check('[data-testid="check-documentation"]');
  });

  test('should allow submission with location consent granted and GPS available', async ({ page, context }) => {
    // Grant geolocation permissions
    await context.grantPermissions(['geolocation']);
    
    // Mock successful geolocation
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 51.5074,
              longitude: -0.1278,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
        }
      });
    });

    // Enable location consent
    await page.check('#locationConsent');
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 10000 });
  });

  test('should allow submission with consent but GPS timeout (should not block)', async ({ page, context }) => {
    // Grant geolocation permissions
    await context.grantPermissions(['geolocation']);
    
    // Mock geolocation timeout (error code 3)
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback, error?: PositionErrorCallback) => {
          setTimeout(() => {
            if (error) {
              error({
                code: 3, // TIMEOUT
                message: 'Timeout expired'
              });
            }
          }, 100);
        }
      });
    });

    // Enable location consent
    await page.check('#locationConsent');
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should show success message even with timeout
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 10000 });
  });

  test('should allow submission with consent but GPS unavailable (should not block)', async ({ page, context }) => {
    // Grant geolocation permissions
    await context.grantPermissions(['geolocation']);
    
    // Mock geolocation unavailable (error code 2)
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback, error?: PositionErrorCallback) => {
          setTimeout(() => {
            if (error) {
              error({
                code: 2, // POSITION_UNAVAILABLE
                message: 'Position unavailable'
              });
            }
          }, 100);
        }
      });
    });

    // Enable location consent
    await page.check('#locationConsent');
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should show success message even with unavailable GPS
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 10000 });
  });

  test('should block submission when GPS permission denied', async ({ page, context }) => {
    // Mock geolocation permission denied (error code 1)
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback, error?: PositionErrorCallback) => {
          setTimeout(() => {
            if (error) {
              error({
                code: 1, // PERMISSION_DENIED
                message: 'Permission denied'
              });
            }
          }, 100);
        }
      });
    });

    // Enable location consent
    await page.check('#locationConsent');
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should show error message and NOT submit
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="success-toast"]')).not.toBeVisible();
  });

  test('should block submission when location consent not given', async ({ page, context }) => {
    // Grant geolocation permissions
    await context.grantPermissions(['geolocation']);
    
    // Mock successful geolocation
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 51.5074,
              longitude: -0.1278,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
        }
      });
    });

    // Do NOT enable location consent - leave checkbox unchecked
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should show error about consent required
    await expect(page.locator('[data-testid="error-toast"]')).toContainText('Location Consent Required');
    await expect(page.locator('[data-testid="success-toast"]')).not.toBeVisible();
  });

  test('should handle browsers without Permissions API', async ({ page }) => {
    // Mock browser without permissions API
    await page.addInitScript(() => {
      // @ts-ignore
      delete navigator.permissions;
      
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        writable: true,
        value: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 51.5074,
              longitude: -0.1278,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
        }
      });
    });

    // Enable location consent
    await page.check('#locationConsent');
    
    // Submit form
    await page.click('[data-testid="submit-sod"]');
    
    // Should proceed and show success (treat as 'unknown' permission state)
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 10000 });
  });
});