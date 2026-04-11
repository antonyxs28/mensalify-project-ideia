#!/usr/bin/env node

/**
 * One-time script to rebuild all billing cycles for existing clients
 * This ensures all cycles are generated from created_at instead of current date
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function rebuildAllCycles() {
  console.log('Starting rebuild of all billing cycles...');

  try {
    // First, get all clients - we'll need to make authenticated requests
    // For now, let's assume we have a way to get client IDs
    // This is a simplified version - in production you'd want proper auth

    console.log('Note: This script needs to be run with proper authentication.');
    console.log('Please run the rebuild manually for each client using:');
    console.log('POST /api/clients/{clientId}/cycles');

    // For demonstration, let's show how it would work for a single client
    console.log('\nExample curl command:');
    console.log(`curl -X POST "${API_BASE}/api/clients/YOUR_CLIENT_ID/cycles" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"`);

  } catch (error) {
    console.error('Error:', error);
  }
}

rebuildAllCycles();
          `✓ Rebuilt ${result.data.rebuilt} cycles for client ${client.id}`,
        );
        successCount++;
      } else {
        console.error(
          `✗ Failed to rebuild cycles for client ${client.id}:`,
          result.error,
        );
        errorCount++;
      }
    } catch (err) {
      console.error(`✗ Error processing client ${client.id}:`, err);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} successful, ${errorCount} errors`);
}

rebuildAllCycles().catch(console.error);
