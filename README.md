# 🏛️ Enhanced DAO Governance Platform

A production-ready decentralized autonomous organization (DAO) where token holders can create, vote on, and finalize funding proposals with advanced voting mechanisms, community features, and comprehensive analytics.

#### &nbsp;&nbsp;&nbsp;&nbsp;Screenshot of Startup Screen (w/ test data):
![Welcome-to-our-DAO](/screenshots/Welcome-to-our-DAO.png)
&nbsp;&nbsp;&nbsp;&nbsp;<em>(see end of readme for additional screenshots)</em>

## 🔑 Key Components
### 🔗 Smart Contract Features

- **Token Integration**: Uses ERC-20 token for governance rights
- **Vote Weighting**: Votes are weighted by token balance
- **Advanced Quorum System**: Proposals require minimum votes to be finalized
- **Tri-State Voting**: Support for For/Against/Abstain votes with separate tracking
- **Cancellation Mechanism**: Proposals can be cancelled if they receive enough negative votes
- **Participation Tracking**: Complete tracking of voter participation rates

## ✨ Core Features

- **Token-Based Governance**: Only token holders can create proposals and vote
- **Proposal Management**: Create, vote, finalize, or cancel proposals with optional deadlines
- **Community Engagement**: Achievement system, anonymous leaderboards, and discussion features
- **Analytics Dashboard**: Comprehensive metrics about proposal activity and voting patterns
- **Cross-Browser Sync**: Robust data persistence with automatic corruption recovery
- **Mobile-Responsive**: Optimized interface for all device types

### 🗳️ **Advanced Voting System**
- **Tri-State Voting**: Vote For, Against, or Abstain on proposals
- **Deadline Management**: Optional voting deadlines with automatic enforcement
- **Vote Confirmation**: Smart confirmation dialogs with voting power display
- **Real-time Status**: Live updates on proposal states and voting progress

### 📊 **Advanced Analytics**
- **Participation Tracking**: See exactly how much of the community has participated
- **Vote Distribution**: Visual breakdown of For/Against/Abstain votes
- **Quorum Progress**: Real-time tracking of quorum achievement
- **Comprehensive Metrics**: Detailed statistics on DAO activity

### 🏆 **Community Engagement**
- **Achievement System**: Progressive levels based on voting participation
- **Anonymous Leaderboards**: Privacy-preserving rankings with fun generated names
- **Proposal Comments**: Modal-based discussion threads with on-chain storage
- **Smart Notifications**: Cross-browser alerts for new proposals and deadlines
- **User Analytics**: Personal voting patterns and response time tracking

### 🎨 **Enhanced User Experience**
- **Progress Bars**: Dual-function bars showing both vote distribution AND total participation
- **Smart Quorum Detection**: Visual indicators when proposals are ready for finalization or cancellation
- **Sticky Table Headers**: Enhanced UX with persistent always-visible column headers during scrolling
- **Mobile-Responsive Design**: Optimized interface for all device sizes

## 🚀 **Latest Enhancements**

### **User Experience Improvements**
- ✅ **Enhanced Tooltips**: Clear explanations for comment counts and form fields
- ✅ **Robust Data Persistence**: Automatic cleanup of corrupted localStorage data
- ✅ **Consistent Notifications**: Cross-browser notification state synchronization with demo data
- ✅ **Improved Spacing**: Better visual hierarchy with centered navbar layout
- ✅ **Timestamp Display**: Enhanced timestamps with date and time for all actions
- ✅ **Mobile Navigation**: Responsive navbar with collapsible menu and mobile-optimized dropdowns
- ✅ **Success Modals for All Actions**: Voting, finalizing, cancelling, AND proposal creation
- ✅ **User-Controlled Page Refresh**: Blockchain data only reloads AFTER user dismisses success modal
- ✅ **Accurate Test Scenarios**: Dual collapsible controls for documentation at bottom of DAPP to deatil deployed test sequence
- ✅ **Persistent Footer**: Always-visible "Create Proposal" button at bottom of page to scroll user to entry form

### **Privacy & Community Features**
- ✅ **Anonymous Names**: Fun, consistent pseudonyms in leaderboards and comments
- ✅ **Smart Badge Display**: Context-aware voting status indicators with timestamps
- ✅ **Enhanced Comments**: Improved comment refresh with automatic data reload
- ✅ **Robust Error Handling**: Graceful fallbacks for BigNumber and data parsing errors
- ✅ **Forced Blockchain Sync**: Notifications always reflect current on-chain state

### **Technical Robustness**
- ✅ **Contract Optimization**: Simplified struct design to avoid stack depth issues
- ✅ **Comprehensive Testing**: 66 passing tests with robust error handling (100% pass rate)
- ✅ **Cross-Browser Compatibility**: Enhanced data persistence across all browsers
- ✅ **Deadline Functionality**: Advanced proposal deadline management with time-based voting restrictions
- ✅ **Enhanced Error Messages**: Clear, descriptive error messages for all contract operations
- ✅ **Ultra-Sticky Headers**: Maximum browser compatibility with fixed column widths
- ✅ **Smart Data Management**: Automatic cleanup of stale data across deployments

## 🚀 Getting Started

### **Deployment Options**
```bash
# Option 1: Clean slate (no test proposals)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js --network localhost
# Skip all test scripts, start frontend: npm start

# Option 2: Full test sequence (recommended for testing)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js --network localhost
npx hardhat run scripts/test-initial-proposals.js --network localhost
npx hardhat run scripts/test-abstain.js --network localhost
npx hardhat run scripts/test-oppose.js --network localhost
npx hardhat run scripts/test-ready-cancel.js --network localhost
npx hardhat run scripts/test-ready-finalize.js --network localhost
npx hardhat run scripts/test-additional-proposals.js --network localhost
npm run start
```

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dao
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

4. **Deploy contracts** (in a new terminal)
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

5. **Seed initial data**
   ```bash
   npx hardhat run scripts/seed.js --network localhost
   ```

6. **Run test scenarios** (optional)**
   ```bash
   # Test initial proposals
   npx hardhat run scripts/test-initial-proposals.js --network localhost

   # Test abstain voting functionality
   npx hardhat run scripts/test-abstain.js --network localhost

   # Test oppose voting and cancellation
   npx hardhat run scripts/test-oppose.js --network localhost

   # Test proposals ready for cancellation
   npx hardhat run scripts/test-ready-cancel.js --network localhost

   # Test proposals ready for finalization
   npx hardhat run scripts/test-ready-finalize.js --network localhost

   # Test additional proposals with comments
   npx hardhat run scripts/test-additional-proposals.js --network localhost
   ```

7. **Start frontend**
   ```bash
   npm run start
   ```

8. **Configure MetaMask**
   - Add localhost network (RPC: http://localhost:8545, Chain ID: 31337)
   - Import test accounts using private keys from Hardhat node output

## 📖 Usage Guide

### Basic Operations
1. **Create Proposals**: Fill out the form with proposal details and funding amount
2. **Vote on Proposals**: Use "👍 For", "👎 Against" buttons, or abstain
3. **Finalize Proposals**: Click "Finalize" when positive votes reach quorum (🤩 Ready to Finalize)
4. **Cancel Proposals**: Click "Cancel" when negative votes reach quorum (😞 Ready to Cancel)
5. **View Analytics**: Monitor DAO activity through the comprehensive analytics dashboard

### Understanding the Interface
- **Status Badges**: Show current proposal state (In Progress 😁, Ready to Finalize 🤩, etc.)
- **Progress Bars**: Display both vote distribution AND total participation percentage
- **Participation Tracking**: See how much of the community has voted
- **Real-time Updates**: Page automatically refreshes after transactions

## 🛠️ **Developer Tools & Debugging**

### **Development Features**
- ✅ **Flexible Deployment**: Choose between clean slate or pre-populated test data
- ✅ **Organized Test Scripts**: Separated initial proposals from additional test data with deadline examples
- ✅ **Automatic Data Cleanup**: Detects contract address changes and clears stale data
- ✅ **Robust Error Handling**: Comprehensive validation with descriptive error messages
- ✅ **Cross-Deployment Persistence**: Smart data management across contract deployments
- ✅ **Debug Functions**: Global functions for data inspection and cleanup
- ✅ **Blockchain Notifications**: Auto-generated notifications from on-chain events
- ✅ **Optimized Cross-Browser Sync**: BroadcastChannel and storage events without resource-intensive polling
- ✅ **Event-Driven Updates**: Real-time sync using modern web APIs without periodic checks

## 🧪 Comprehensive Testing

### Test Suites
Our testing framework covers all aspects of the DAO functionality:

#### **Core DAO Tests** (`test/DAO.js`) ✅ **PASSING**
```bash
npx hardhat test test/DAO.js
```
- ✅ Contract deployment and initialization
- ✅ Token holder validation and access control
- ✅ Proposal creation with comprehensive validation
- ✅ Multi-type voting mechanisms (For/Against/Abstain)
- ✅ Quorum requirements and proposal finalization
- ✅ Secure fund distribution and error handling

#### **Deadline Features** (`test/DeadlineFeatures.js`)
```bash
npx hardhat test test/DeadlineFeatures.js
```
- ✅ Proposal creation with optional deadlines
- ✅ Deadline validation (future dates only)
- ✅ Voting enforcement before/after deadlines

#### **Community Features** (`test/CommunityFeatures.js`)
```bash
npx hardhat test test/CommunityFeatures.js
```
- ✅ Multi-user voting power scenarios
- ✅ Participation tracking across multiple proposals
- ✅ Vote distribution analysis and metrics
- ✅ Complex governance scenarios and edge cases

### Running Tests
```bash
# Run all tests
npx hardhat test

# Run with detailed output
npx hardhat test --verbose

# Run specific test file
npx hardhat test test/DeadlineFeatures.js

# Run specific test by name (using grep)
npx hardhat test --grep "Should reject voting after deadline"

# Run with gas reporting
REPORT_GAS=true npx hardhat test
# or
npx hardhat test --gas-report

# Generate coverage report
npx hardhat coverage
```

### **Testing Guide**
```bash
# Core DAO Test
npx hardhat test test/DAO.js

# Deadline Features
npx hardhat test test/DeadlineFeatures.js

# Community Features
npx hardhat test test/CommunityFeatures.js
```

### **Data Management Tools**
```javascript
// Clear all localStorage data (available in browser console)
window.forceClearAllData()

// Check current contract address
localStorage.getItem('daoContractAddress')

// View stored notifications
JSON.parse(localStorage.getItem('daoNotifications') || '[]')
```

## 🛠️ Technical Details

### Technology Stack
- **Frontend**: React 18, Bootstrap 5, Ethers.js
- **Blockchain**: Hardhat, Solidity ^0.8.0
- **Styling**: Custom CSS with glassmorphism effects
- **State Management**: React Hooks

### Prerequisites
- Node.js (v14 or higher)
- Hardhat (v2.10 or higher)
- MetaMask browser extension
- Git

### Smart Contract Architecture
- **DAO.sol**: Main governance contract with tri-state voting
- **Token.sol**: ERC-20 token for governance rights
- **Quorum System**: 500,000+ tokens required for proposal finalization/cancellation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
<br><br/>
## Additional Screenshots:

### &nbsp;&nbsp;&nbsp;Desktop:
![Engagement-Leaderboard-Analytics](/screenshots/Engagement-Leaderboard-Analytics.png)
![Proposals|Governance9-12](/screenshots/Proposals|Governance9-12.png)
![Proposals|Governance2-6](/screenshots/Proposals|Governance2-6.png)
![Test-Voting-Senarios](/screenshots/Test-Voting-Senarios.png)
![DemoSetup-desktop](/screenshots/DemoSetup-desktop.png)

### &nbsp;&nbsp;&nbsp;Mobile:
![DemoSetup_mobile1](/screenshots/DemoSetup_mobile1.png)
![DemoSetup_mobile2](/screenshots/DemoSetup_mobile2.png)
![Notifications_mobile](/screenshots/Notifications_mobile.png)
![Success_votedFor_mobile](/screenshots/Success_votedFor_mobile.png)

## 👷🏼 Create your first proposal and start voting 🥳!
For questions or support, please open an issue in the 'dao' repository
