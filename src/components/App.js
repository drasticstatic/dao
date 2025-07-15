import { useEffect, useState, useCallback } from 'react'
import { Container, Button, Alert, Modal } from 'react-bootstrap'
import { ethers } from 'ethers'

// Components
import Navigation from './Navigation';
import Create from './Create';
import Proposals from './Proposals';
import ProposalAnalytics from './ProposalAnalytics';
import Loading from './Loading';

// Styles
import './GlobalStyles.css';
import './VotingStyles.css';

// ABIs: Import your contract ABIs here
import DAO_ABI from '../abis/DAO.json'

// Config: Import your network config here
import config from '../config.json';

// Utils: Import blockchain sync utilities
import { syncAllDataFromBlockchain } from '../utils/blockchainSync';

function App() {
  const [provider, setProvider] = useState(null)
  const [dao, setDao] = useState(null)
  const [treasuryBalance, setTreasuryBalance] = useState(0)

  const [account, setAccount] = useState("") // empty string instead of null to avoid error --
  // Cannot read properties of null (reading 'slice') at Navigation (Navigation.js:17:1)

  const [proposals, setProposals] = useState(null)
  const [quorum, setQuorum] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [walletConnected, setWalletConnected] = useState(false)
  const [proposalCreationSuccess, setProposalCreationSuccess] = useState('')
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('daoNotifications');
      const parsed = saved ? JSON.parse(saved) : [];

      // Clean up any corrupted notification data
      const cleanNotifications = parsed.filter(n =>
        n && typeof n === 'object' && n.title && n.message
      );

      // If we cleaned up data, save the clean version
      if (cleanNotifications.length !== parsed.length) {
        localStorage.setItem('daoNotifications', JSON.stringify(cleanNotifications));
      }

      // Only add demo notifications if no blockchain data will be loaded
      if (cleanNotifications.length === 0 && !window.ethereum) {
        const demoNotifications = [
          {
            id: 'demo-1',
            title: 'New Proposal Created',
            message: 'A new funding proposal has been submitted for review',
            type: 'new_proposal',
            timestamp: Date.now() - 3600000, // 1 hour ago
            read: false
          },
          {
            id: 'demo-2',
            title: 'Proposal Deadline Approaching',
            message: 'Voting deadline for "Community Fund" proposal is in 24 hours',
            type: 'deadline_approaching',
            timestamp: Date.now() - 7200000, // 2 hours ago
            read: false
          }
        ];
        localStorage.setItem('daoNotifications', JSON.stringify(demoNotifications));
        return demoNotifications;
      }

      return cleanNotifications;
    } catch (error) {
      console.warn('Corrupted notification data, clearing:', error);
      localStorage.removeItem('daoNotifications');
      return [];
    }
  })
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false)

  // Function to mark notification as read
  const markNotificationRead = (index) => {
    const updatedNotifications = [...notifications];
    if (updatedNotifications[index]) {
      updatedNotifications[index].read = true;
      updatedNotifications[index].readTimestamp = Date.now();
      setNotifications(updatedNotifications);
      localStorage.setItem('daoNotifications', JSON.stringify(updatedNotifications));

      // Also store read state with a unique key for cross-browser sync
      const notificationId = updatedNotifications[index].id;
      if (notificationId) {
        localStorage.setItem(`notification-read-${notificationId}`, 'true');
      }

      // Enhanced multi-mechanism sync for cross-browser compatibility
      // 1. Storage event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'daoNotifications',
        newValue: JSON.stringify(updatedNotifications),
        storageArea: localStorage
      }));

      // 2. Custom event for same-tab sync
      window.dispatchEvent(new CustomEvent('notificationSync', {
        detail: { notifications: updatedNotifications }
      }));

      // 3. Force localStorage update with timestamp
      localStorage.setItem('daoNotificationsLastUpdate', Date.now().toString());

      // 4. Broadcast Channel API for modern browsers
      try {
        const channel = new BroadcastChannel('dao-notifications');
        channel.postMessage({
          type: 'NOTIFICATION_UPDATE',
          notifications: updatedNotifications,
          timestamp: Date.now()
        });
        channel.close();
      } catch (error) {
        console.log('BroadcastChannel not supported, using fallback methods');
      }

      // 5. IndexedDB flag for persistent cross-browser sync
      try {
        if ('indexedDB' in window) {
          const request = indexedDB.open('dao-sync', 1);
          request.onsuccess = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains('notifications')) {
              const transaction = db.transaction(['notifications'], 'readwrite');
              const store = transaction.objectStore('notifications');
              store.put({
                id: 'latest',
                notifications: updatedNotifications,
                timestamp: Date.now()
              });
            }
          };
        }
      } catch (error) {
        console.log('IndexedDB not available for cross-browser sync');
      }
    }
  }

  // Function to show all notifications modal
  const showAllNotifications = () => {
    setShowAllNotificationsModal(true);
  }

  // Function to force clear all cached data (for development/debugging)
  const forceClearAllData = () => {
    const keysToRemove = ['daoNotifications', 'daoProposalComments', 'daoVoteHistory', 'daoContractAddress'];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear notification read markers
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('notification-read-')) {
        localStorage.removeItem(key);
      }
    });

    console.log('All DAO data cleared from localStorage');
  }

  // Expose function globally for debugging
  window.forceClearAllData = forceClearAllData;

  // Function to generate notifications from blockchain data
  const generateBlockchainNotifications = async (proposals) => {
    try {
      // Force fresh notification generation - clear old blockchain notifications
      const existingNotifications = JSON.parse(localStorage.getItem('daoNotifications') || '[]');
      const nonBlockchainNotifications = existingNotifications.filter(n =>
        !n.id.startsWith('proposal-') &&
        !n.id.startsWith('deadline-') &&
        !n.id.startsWith('finalized-') &&
        !n.id.startsWith('cancelled-')
      );

      const newNotifications = [];

      // Check for new proposals
      for (const proposal of proposals) {
        const proposalId = `proposal-${proposal.id}`;

        // Always create notification for proposals (force refresh)
        newNotifications.push({
          id: proposalId,
          title: 'Proposal Available',
          message: `"${proposal.name}" - ${proposal.finalized ? 'Completed' : proposal.cancelled ? 'Cancelled' : 'Active'}`,
          type: proposal.finalized ? 'proposal_finalized' : proposal.cancelled ? 'proposal_cancelled' : 'new_proposal',
          timestamp: Date.now() - (proposal.id * 3600000), // Stagger timestamps
          read: false
        });

        // Check for deadline approaching (within 24 hours)
        if (proposal.deadline && proposal.deadline > 0) {
          const deadlineTime = proposal.deadline * 1000;
          const now = Date.now();
          const timeUntilDeadline = deadlineTime - now;
          const oneDayInMs = 24 * 60 * 60 * 1000;

          if (timeUntilDeadline > 0 && timeUntilDeadline <= oneDayInMs) {
            const deadlineId = `deadline-${proposal.id}`;
            const existingDeadlineNotification = existingNotifications.find(n => n.id === deadlineId);

            if (!existingDeadlineNotification) {
              newNotifications.push({
                id: deadlineId,
                title: 'Proposal Deadline Approaching',
                message: `"${proposal.name}" voting ends in less than 24 hours`,
                type: 'deadline_approaching',
                timestamp: Date.now(),
                read: false
              });
            }
          }
        }

        // Check for finalized proposals
        if (proposal.finalized) {
          const finalizedId = `finalized-${proposal.id}`;
          const existingFinalizedNotification = existingNotifications.find(n => n.id === finalizedId);

          if (!existingFinalizedNotification) {
            newNotifications.push({
              id: finalizedId,
              title: 'Proposal Finalized',
              message: `"${proposal.name}" has been approved and executed`,
              type: 'proposal_finalized',
              timestamp: Date.now(),
              read: false
            });
          }
        }

        // Check for cancelled proposals
        if (proposal.cancelled) {
          const cancelledId = `cancelled-${proposal.id}`;
          const existingCancelledNotification = existingNotifications.find(n => n.id === cancelledId);

          if (!existingCancelledNotification) {
            newNotifications.push({
              id: cancelledId,
              title: 'Proposal Cancelled',
              message: `"${proposal.name}" has been cancelled due to negative votes`,
              type: 'proposal_cancelled',
              timestamp: Date.now(),
              read: false
            });
          }
        }
      }

      // Combine non-blockchain notifications with new blockchain notifications
      const allNotifications = [...nonBlockchainNotifications, ...newNotifications];
      localStorage.setItem('daoNotifications', JSON.stringify(allNotifications));
      setNotifications(allNotifications);
      // console.log(`Generated ${newNotifications.length} notifications from blockchain data (${proposals.length} proposals)`); // Removed for performance
    } catch (error) {
      console.error('Error generating blockchain notifications:', error);
    }
  };

  // Function to clear stale data and reset app state
  const clearStaleData = useCallback(() => {
    try {
      // Clear potentially corrupted data
      const keysToCheck = ['daoNotifications', 'daoProposalComments', 'daoVoteHistory'];
      keysToCheck.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data); // Test if it's valid JSON

            // Additional validation for notifications
            if (key === 'daoNotifications' && Array.isArray(parsed)) {
              const validNotifications = parsed.filter(n =>
                n && typeof n === 'object' && n.title && n.message && n.timestamp
              );
              if (validNotifications.length !== parsed.length) {
                console.warn(`Cleaning invalid notifications from ${key}`);
                localStorage.setItem(key, JSON.stringify(validNotifications));
              }
            }

            // Additional validation for vote history
            if (key === 'daoVoteHistory' && typeof parsed === 'object') {
              const validVoteHistory = {};
              Object.entries(parsed).forEach(([proposalId, voteData]) => {
                if (voteData && voteData.type && voteData.timestamp) {
                  validVoteHistory[proposalId] = voteData;
                }
              });
              if (Object.keys(validVoteHistory).length !== Object.keys(parsed).length) {
                console.warn(`Cleaning invalid vote history from ${key}`);
                localStorage.setItem(key, JSON.stringify(validVoteHistory));
              }
            }
          }
        } catch (error) {
          console.warn(`Clearing corrupted ${key}:`, error);
          localStorage.removeItem(key);

          // Also clear any related read state markers
          if (key === 'daoNotifications') {
            Object.keys(localStorage).forEach(storageKey => {
              if (storageKey.startsWith('notification-read-')) {
                localStorage.removeItem(storageKey);
              }
            });
          }
        }
      });

      // Clear deployment-specific data when contract addresses change
      const currentContractAddress = dao?.address;
      const storedContractAddress = localStorage.getItem('daoContractAddress');

      if (currentContractAddress && storedContractAddress && currentContractAddress !== storedContractAddress) {
        console.warn('Contract address changed, clearing deployment-specific data');
        ['daoNotifications', 'daoProposalComments', 'daoVoteHistory'].forEach(key => {
          localStorage.removeItem(key);
        });
        localStorage.setItem('daoContractAddress', currentContractAddress);
      } else if (currentContractAddress && !storedContractAddress) {
        localStorage.setItem('daoContractAddress', currentContractAddress);
      }
    } catch (error) {
      console.warn('Error during data cleanup:', error);
    }
  }, [dao?.address])


  const [error, setError] = useState(null)

  const connectWallet = async () => {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      setWalletConnected(true)
      setIsLoading(true)
      loadBlockchainData()
    } catch (error) {
      console.error('Error connecting wallet:', error)
      setIsLoading(false)
    }
  }

  const loadBlockchainData = useCallback(async () => {
    // Clean up any corrupted data first
    clearStaleData();

    if (!window.ethereum) {
      console.error('MetaMask not detected')
      setIsLoading(false)
      return
    }

    let timeoutId;
    try {
      setIsLoading(true)
      console.log('🚀 Initializing DAO application...')

      // Add timeout to prevent hanging
      timeoutId = setTimeout(() => {
        console.error('Loading timeout - forcing completion');
        setIsLoading(false);
        setWalletConnected(false);
      }, 20000); // 20 second timeout

      // Initiate provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)
      // console.log('Provider set') // Removed for performance

      // Check network
      const network = await provider.getNetwork()
      // console.log('Network:', network) // Removed for performance

      if (!config[network.chainId]) {
        throw new Error(`Unsupported network. Please switch to localhost (chainId: 31337)`)
      }

      // Initiate contracts
      const dao = new ethers.Contract(config[network.chainId].dao.address, DAO_ABI, provider)
      setDao(dao)
      // console.log('DAO contract set') // Removed for performance

      // Fetch treasury balance
      let treasuryBalance = await provider.getBalance(dao.address)
      treasuryBalance = ethers.utils.formatUnits(treasuryBalance, 18)
      setTreasuryBalance(treasuryBalance)
      // console.log('Treasury balance:', treasuryBalance) // Removed for performance

      // Fetch accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }
      const account = ethers.utils.getAddress(accounts[0])
      setAccount(account)
      // console.log('Account set:', account) // Removed for performance

      // Fetch proposals count
      const count = await dao.proposalCount()
      // console.log('Proposal count:', count.toString()) // Removed for performance
      const items = []

      // "i" = iterator
      for(var i = 0; i < count; i++) {
        const proposal = await dao.proposals(i + 1) // i+1 b/c i=0 initially

        // Fetch separate vote counts
        const forVotes = await dao.proposalForVotes(i + 1)
        const againstVotes = await dao.proposalAgainstVotes(i + 1)
        const abstainVotes = await dao.proposalAbstainVotes(i + 1)

        // Add vote details to proposal object
        const enhancedProposal = {
          ...proposal,
          forVotes,
          againstVotes,
          abstainVotes
        }

        items.push(enhancedProposal) // "push" is a function that adds (at the end) to the items array above
      }

      setProposals(items)
      // console.log('Proposals loaded:', items) // Removed for performance

      // Generate notifications from blockchain data
      await generateBlockchainNotifications(items)

      // Fetch quorum
      const quorumValue = await dao.quorum()
      setQuorum(quorumValue)
      // console.log('Quorum:', quorumValue.toString()) // Removed for performance

      // Sync additional blockchain data (notifications, vote history, analytics)
      try {
        // console.log('🔄 Syncing blockchain data...'); // Removed to reduce console noise
        const syncResult = await syncAllDataFromBlockchain(dao, provider, account);

        // Update notifications state with synced data
        if (syncResult && syncResult.notifications) {
          setNotifications(syncResult.notifications);
        }

        // console.log('✅ Blockchain sync completed'); // Removed to reduce console noise
      } catch (syncError) {
        console.warn('⚠️ Blockchain sync failed, using localStorage fallback:', syncError);
        // Fallback to localStorage if blockchain sync fails
        const storedNotifications = JSON.parse(localStorage.getItem('daoNotifications') || '[]');
        setNotifications(storedNotifications);
      }

      // Clear timeout and complete loading
      clearTimeout(timeoutId);
      setIsLoading(false)
      setWalletConnected(true)
      console.log('✅ DAO application ready! Connected to:', account)
    } catch (error) {
      console.error('Error loading blockchain data:', error)
      clearTimeout(timeoutId);
      setError(error.message)
      setIsLoading(false)
      setWalletConnected(false)
    }
  }, [clearStaleData])

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts.length > 0) {
            setWalletConnected(true)
            loadBlockchainData()
          } else {
            setWalletConnected(false)
            setIsLoading(false)
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error)
          setWalletConnected(false)
          setIsLoading(false)
        }
      } else {
        setWalletConnected(false)
        setIsLoading(false)
      }
    }

    checkWalletConnection()

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletConnected(true)
          setIsLoading(true)
          loadBlockchainData()
        } else {
          setWalletConnected(false)
          setAccount("")
          setProposals(null)
          setIsLoading(false)
        }
      })
    }
  }, [loadBlockchainData]);

  // Enhanced cross-browser notification sync with multiple mechanisms
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'daoNotifications' && e.newValue) {
        try {
          const updatedNotifications = JSON.parse(e.newValue);
          setNotifications(updatedNotifications);
          console.log('Notifications synced from another browser/tab via storage event');
        } catch (error) {
          console.error('Error syncing notifications:', error);
        }
      }
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Custom events for same-tab updates
    const handleCustomSync = (e) => {
      if (e.detail && e.detail.notifications) {
        setNotifications(e.detail.notifications);
        console.log('Notifications synced within same tab');
      }
    };

    window.addEventListener('notificationSync', handleCustomSync);

    // BroadcastChannel for modern cross-browser sync
    let broadcastChannel;
    try {
      broadcastChannel = new BroadcastChannel('dao-notifications');
      broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'NOTIFICATION_UPDATE') {
          setNotifications(event.data.notifications);
          console.log('Notifications synced via BroadcastChannel');
        }
      };
    } catch (error) {
      console.log('BroadcastChannel not supported');
    }

    // Removed periodic sync to prevent overheating - using event-based sync only

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('notificationSync', handleCustomSync);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [notifications])

  return(
    <div className="app-container">
      <Navigation
        account={account}
        walletConnected={walletConnected}
        notifications={notifications}
        onMarkNotificationRead={markNotificationRead}
        onShowAllNotifications={showAllNotifications}
      />
      <Container className="content-container" style={{ paddingTop: '44px', paddingBottom: '60px' }}>

      <div className="text-center my-4">
        <h1 className='mb-2'>Welcome to our DAO!</h1>
        <p className="text-muted">
          A Decentralized Autonomous Organization where token holders vote on funding proposals
        </p>
      </div>

      {!window.ethereum ? (
        <Alert variant="warning" className="text-center">
          <h4>MetaMask Required</h4>
          <p>Please install MetaMask to use this DAO application.</p>
        </Alert>
      ) : !walletConnected ? (
        <div className="text-center">
          <Alert variant="info">
            <h4>Connect Your Wallet</h4>
            <p>Please connect your MetaMask wallet to interact with the DAO.</p>
          </Alert>
          <Button variant="primary" size="lg" onClick={connectWallet}>
            Connect Wallet
          </Button>
        </div>
      ) : error ? (
        <div className="text-center">
          <Alert variant="danger">
            <h4>Error Loading Data</h4>
            <p>{error}</p>
            <p className="mb-3">Please ensure:</p>
            <ul className="text-start">
              <li>Hardhat node is running: <code>npx hardhat node</code></li>
              <li>Contracts are deployed: <code>npx hardhat run scripts/deploy.js --network localhost</code></li>
              <li>MetaMask is connected to localhost:8545</li>
            </ul>
          </Alert>
          <Button variant="primary" onClick={() => {
            setError(null)
            setIsLoading(true)
            loadBlockchainData()
          }}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <Loading />
      ) : (
        <>
          <Create
            provider={provider}
            dao={dao}
            setIsLoading={setIsLoading}
            loadBlockchainData={loadBlockchainData}
            onProposalCreated={setProposalCreationSuccess}
          />

          <hr/>

          <p className='text-center'><strong>Treasury Balance:</strong> {treasuryBalance} ETH</p>

          <hr/>

          {proposals && quorum && (
            <ProposalAnalytics 
              proposals={proposals}
              quorum={quorum}
            />
          )}

          {proposals && (
            <Proposals
              provider={provider}
              dao={dao}
              proposals={proposals}
              quorum={quorum}
              setIsLoading={setIsLoading}
              loadBlockchainData={loadBlockchainData}
              proposalCreationSuccess={proposalCreationSuccess}
              setProposalCreationSuccess={setProposalCreationSuccess}
            />
          )}
        </>
      )}
      </Container>

      {/* Persistent Footer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f8f9fa',
          borderTop: '1.5px solid #dee2e6',
          padding: '11px 0',
          textAlign: 'center',
          zIndex: 1000,
          fontSize: '0.9rem'
        }}
      >
        <strong
          style={{
            cursor: 'pointer',
            color: '#0d6efd',
            padding: '4px 8px'
          }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Click to scroll to top of page"
        >
          <big>↑</big>&nbsp;<u>Click here<big>👆</big>to create new proposals<big> 📝 </big> using form above</u>&nbsp;<big>↑</big>
        </strong>
      </div>

      {/* All Notifications Modal */}
      <Modal show={showAllNotificationsModal} onHide={() => setShowAllNotificationsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🔔 All Notifications</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div className="text-center text-muted py-4">
              <div style={{ fontSize: '3rem' }}>📭</div>
              <p>No notifications yet</p>
              <small>You'll be notified about new proposals and voting deadlines</small>
            </div>
          ) : (
            <div className="list-group">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className={`list-group-item ${!notification.read ? 'bg-light' : ''}`}
                  onClick={() => markNotificationRead(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex w-100 justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1">
                        <span className="me-2" style={{ fontSize: '1.2rem' }}>
                          {notification.type === 'new_proposal' ? '📝' :
                           notification.type === 'deadline_approaching' ? '⏰' :
                           notification.type === 'proposal_finalized' ? '✅' :
                           notification.type === 'proposal_cancelled' ? '❌' : '📢'}
                        </span>
                        {notification.title}
                      </h6>
                      <p className="mb-1 text-muted">{notification.message}</p>
                      <small className="text-muted">
                        {new Date(notification.timestamp).toLocaleString()}
                      </small>
                    </div>
                    {!notification.read && (
                      <span className="badge bg-primary ms-2">New</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAllNotificationsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default App;
