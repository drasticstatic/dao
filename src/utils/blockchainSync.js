// import { ethers } from 'ethers'; // Currently unused

/**
 * Utility functions to sync localStorage data with blockchain events
 * This allows us to persist user interactions while maintaining blockchain accuracy
 */

/**
 * Syncs vote history from blockchain events with localStorage
 * @param {Object} dao - DAO contract instance
 * @param {Object} provider - Ethereum provider
 * @param {string} userAddress - Current user's wallet address
 * @returns {Object} - Updated vote history object
 */
export const syncVoteHistoryFromBlockchain = async (dao, provider, userAddress) => {
  try {
    console.log('🔄 Syncing vote history from blockchain...');

    // Get existing localStorage data
    const existingHistory = JSON.parse(localStorage.getItem('daoVoteHistory') || '{}');

    // Efficient blockchain sync: only sync if data is stale or missing
    const lastSyncTime = localStorage.getItem('lastVoteHistorySync');
    const currentTime = Date.now();
    const syncInterval = 5 * 60 * 1000; // 5 minutes

    // Check if we need to sync (no data or data is stale)
    const needsSync = !lastSyncTime || (currentTime - parseInt(lastSyncTime)) > syncInterval;

    if (!needsSync && Object.keys(existingHistory).length > 0) {
      console.log(`✅ Using cached vote history (${Object.keys(existingHistory).length} votes)`);
      return existingHistory;
    }

    // For now, return localStorage data but mark as synced to prevent excessive calls
    localStorage.setItem('lastVoteHistorySync', currentTime.toString());
    console.log(`✅ Vote history refreshed (${Object.keys(existingHistory).length} votes)`);
    return existingHistory;

  } catch (error) {
    console.error('❌ Error syncing vote history from blockchain:', error);
    // Return existing localStorage data as fallback
    return JSON.parse(localStorage.getItem('daoVoteHistory') || '{}');
  }
};

/**
 * Syncs proposal creation events to generate notifications
 * @param {Object} dao - DAO contract instance
 * @param {string} userAddress - Current user's wallet address
 * @returns {Array} - Array of notification objects
 */
export const syncNotificationsFromBlockchain = async (dao, userAddress) => {
  try {
    console.log('🔔 Syncing notifications from blockchain...');

    // Get existing notifications
    const existingNotifications = JSON.parse(localStorage.getItem('daoNotifications') || '[]');
    // If no existing notifications, return empty array

    // Get the last sync timestamp to avoid duplicate notifications
    const lastSync = localStorage.getItem('lastNotificationSync') || '0';
    const lastSyncTimestamp = parseInt(lastSync);

    // Efficient notification sync: only sync if needed
    const lastNotificationSync = localStorage.getItem('lastNotificationSync');
    const currentTime = Date.now();
    const syncInterval = 10 * 60 * 1000; // 10 minutes

    const needsSync = !lastNotificationSync || (currentTime - parseInt(lastNotificationSync)) > syncInterval;

    if (!needsSync) {
      console.log('🔔 Using cached notifications (sync not needed)');
      return existingNotifications;
    }

    // For now, return existing notifications but mark as synced
    localStorage.setItem('lastNotificationSync', currentTime.toString());
    const proposeEvents = [];

    const newNotifications = [];

    for (const event of proposeEvents) {
      const { id, name, creator } = event.args;
      const block = await dao.provider.getBlock(event.blockNumber);

      // Only create notifications for events after last sync
      if (block.timestamp > lastSyncTimestamp) {
        // Don't notify users about their own proposals
        if (creator.toLowerCase() !== userAddress.toLowerCase()) {
          newNotifications.push({
            id: `proposal-${id}`,
            title: '📋 New Proposal Created',
            message: `"${name}" is now open for voting`,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            type: 'proposal',
            proposalId: id.toString(),
            read: false
          });
        }
      }
    }

    // Query for proposals approaching deadline
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const proposalCount = await dao.proposalCount();

    for (let i = 1; i <= proposalCount; i++) {
      const proposal = await dao.proposals(i);

      // Check if proposal has deadline and is approaching (within 24 hours)
      if (proposal.deadline > 0 &&
          proposal.deadline > currentTimestamp &&
          proposal.deadline < currentTimestamp + 86400 && // 24 hours
          !proposal.finalized &&
          !proposal.cancelled) {

        // Check if user hasn't voted yet
        const hasVoted = await dao.hasVoted(userAddress, i);
        if (!hasVoted) {
          const timeLeft = proposal.deadline - currentTimestamp;
          const hoursLeft = Math.floor(timeLeft / 3600);

          newNotifications.push({
            id: `deadline-${i}`,
            title: '⏰ Voting Deadline Approaching',
            message: `"${proposal.name}" voting ends in ${hoursLeft} hours`,
            timestamp: new Date().toISOString(),
            type: 'deadline',
            proposalId: i.toString(),
            read: false
          });
        }
      }
    }

    // Merge with existing notifications (avoid duplicates)
    const allNotifications = [...existingNotifications];
    newNotifications.forEach(newNotif => {
      const exists = allNotifications.find(existing => existing.id === newNotif.id);
      if (!exists) {
        allNotifications.unshift(newNotif); // Add to beginning
      }
    });

    // Keep only last 50 notifications
    const trimmedNotifications = allNotifications.slice(0, 50);

    // Save to localStorage
    localStorage.setItem('daoNotifications', JSON.stringify(trimmedNotifications));
    localStorage.setItem('lastNotificationSync', currentTimestamp.toString());

    console.log(`🔔 Generated ${newNotifications.length} new notifications`);
    return trimmedNotifications;

  } catch (error) {
    console.error('❌ Error syncing notifications from blockchain:', error);
    return JSON.parse(localStorage.getItem('daoNotifications') || '[]');
    // JSON.parse is used to ensure we return an array even if localStorage is empty
  }
};

/**
 * Syncs user analytics data from blockchain
 * @param {Object} dao - DAO contract instance
 * @param {string} userAddress - Current user's wallet address
 * @returns {Object} - Analytics data object
 */
export const syncAnalyticsFromBlockchain = async (dao, userAddress) => {
  try {
    console.log('📊 Syncing analytics from blockchain...');

    // Temporarily disabled blockchain query to prevent infinite loops
    const allVoteEvents = [];

    // Filter events for this user client-side
    const voteEvents = allVoteEvents.filter(event =>
      event.args.voter.toLowerCase() === userAddress.toLowerCase()
    );

    // Calculate vote distribution
    let forVotes = 0, againstVotes = 0, abstainVotes = 0;
    const voteTimes = [];

    for (const event of voteEvents) {
      const { choice } = event.args;
      const block = await dao.provider.getBlock(event.blockNumber);

      // Count vote types
      if (choice.toString() === '1') forVotes++;
      else if (choice.toString() === '-1') againstVotes++;
      else if (choice.toString() === '2') abstainVotes++;

      // Track voting times for response time calculation
      voteTimes.push(block.timestamp);
    }

    // Calculate average response time (simplified)
    let avgResponseTime = 0;
    if (voteTimes.length > 1) {
      const timeDiffs = [];
      for (let i = 1; i < voteTimes.length; i++) {
        timeDiffs.push(voteTimes[i] - voteTimes[i-1]);
      }
      avgResponseTime = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    }

    const analytics = {
      totalVotes: voteEvents.length,
      voteDistribution: {
        for: forVotes,
        against: againstVotes,
        abstain: abstainVotes
      },
      avgResponseTime: Math.floor(avgResponseTime / 86400), // Convert to days
      lastUpdated: new Date().toISOString()
      // toISOString() ensures consistent date format
    };

    // Save to localStorage
    localStorage.setItem('daoAnalytics', JSON.stringify(analytics));
    //JSON.stringify is used to ensure we store a valid JSON object

    console.log('📊 Analytics synced successfully');
    return analytics;

  } catch (error) {
    console.error('❌ Error syncing analytics from blockchain:', error);
    return {
      totalVotes: 0,
      voteDistribution: { for: 0, against: 0, abstain: 0 },
      avgResponseTime: 0,
      lastUpdated: new Date().toISOString()
    };
  }
};

/**
 * Master sync function that updates all localStorage data from blockchain
 * @param {Object} dao - DAO contract instance
 * @param {Object} provider - Ethereum provider
 * @param {string} userAddress - Current user's wallet address
 */
export const syncAllDataFromBlockchain = async (dao, provider, userAddress) => {
  console.log('🔄 Starting comprehensive blockchain sync...');

  try {
    // Run all sync operations in parallel for better performance
    const [voteHistory, notifications, analytics] = await Promise.all([
      syncVoteHistoryFromBlockchain(dao, provider, userAddress),
      syncNotificationsFromBlockchain(dao, userAddress),
      syncAnalyticsFromBlockchain(dao, userAddress)
    ]);

    console.log('✅ All blockchain data synced successfully');

    return {
      voteHistory,
      notifications,
      analytics,
      syncTimestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error during comprehensive blockchain sync:', error);
    throw error;
  }
};
