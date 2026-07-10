import { checkProximity } from '../app/services/proximityService.js';

describe('proximityService', () => {
  describe('checkProximity', () => {
    // Test coordinates (Bangalore area)
    const customerLocation = { lat: 12.9716, lng: 77.5946 };
    
    it('should return inRange false when distance is greater than 1000m', () => {
      // Approximately 1113m away
      const deliveryLocation = { lat: 12.9816, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(result.inRange).toBe(false);
      expect(result.distance).toBeGreaterThanOrEqual(1000);
      expect(result.distance).toBeLessThanOrEqual(1200);
    });
    
    it('should return inRange true when distance is less than 1000m', () => {
      // Approximately 11m away
      const deliveryLocation = { lat: 12.9717, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(result.inRange).toBe(true);
      expect(result.distance).toBeLessThan(1000);
    });
    
    it('should return inRange false when distance is greater than 1500m', () => {
      // Approximately 3780m away
      const deliveryLocation = { lat: 13.0056, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(result.inRange).toBe(false);
      expect(result.distance).toBeGreaterThan(1500);
    });
    
    it('should return inRange true just below 1000m boundary', () => {
      // ~989m away
      const deliveryLocation = { lat: 12.9805, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThanOrEqual(1000);
      expect(result.inRange).toBe(true);
    });
    
    it('should return inRange false just above 1000m boundary', () => {
      // ~1011m away
      const deliveryLocation = { lat: 12.9807, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(result.distance).toBeGreaterThan(1000);
      expect(result.inRange).toBe(false);
    });
    
    it('should return distance as a number', () => {
      const deliveryLocation = { lat: 12.9728, lng: 77.5946 };
      const result = checkProximity(deliveryLocation, customerLocation);
      
      expect(typeof result.distance).toBe('number');
      expect(result.distance).toBeGreaterThan(0);
    });
    
    it('should throw error when deliveryLocation is missing', () => {
      expect(() => {
        checkProximity(null, customerLocation);
      }).toThrow('deliveryLocation must be an object');
    });
    
    it('should throw error when customerLocation is missing', () => {
      const deliveryLocation = { lat: 12.9728, lng: 77.5946 };
      expect(() => {
        checkProximity(deliveryLocation, null);
      }).toThrow('customerLocation must be an object');
    });
    
    it('should throw error when deliveryLocation has non-numeric coordinates', () => {
      const deliveryLocation = { lat: '12.9728', lng: 77.5946 };
      expect(() => {
        checkProximity(deliveryLocation, customerLocation);
      }).toThrow('deliveryLocation must have numeric lat and lng properties');
    });
    
    it('should throw error when customerLocation has non-numeric coordinates', () => {
      const deliveryLocation = { lat: 12.9728, lng: 77.5946 };
      const invalidCustomer = { lat: 12.9716, lng: 'invalid' };
      expect(() => {
        checkProximity(deliveryLocation, invalidCustomer);
      }).toThrow('customerLocation must have numeric lat and lng properties');
    });
    
    it('should throw error when latitude is out of range', () => {
      const deliveryLocation = { lat: 91, lng: 77.5946 };
      expect(() => {
        checkProximity(deliveryLocation, customerLocation);
      }).toThrow('deliveryLocation.lat must be between -90 and 90');
    });
    
    it('should throw error when longitude is out of range', () => {
      const deliveryLocation = { lat: 12.9728, lng: 181 };
      expect(() => {
        checkProximity(deliveryLocation, customerLocation);
      }).toThrow('deliveryLocation.lng must be between -180 and 180');
    });
    
    it('should handle same location (0 distance)', () => {
      const result = checkProximity(customerLocation, customerLocation);
      
      expect(result.distance).toBe(0);
      expect(result.inRange).toBe(true); // 0m is within 0-1000m inclusive
    });
    
    it('should handle locations across different hemispheres', () => {
      const location1 = { lat: 40.7128, lng: -74.0060 }; // New York
      const location2 = { lat: 51.5074, lng: -0.1278 };  // London
      const result = checkProximity(location1, location2);
      
      expect(typeof result.distance).toBe('number');
      expect(result.distance).toBeGreaterThan(0);
      expect(result.inRange).toBe(false); // Way too far
    });
  });
});
