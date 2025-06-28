import { useEffect, useState } from 'react'
import { Container, Button, Alert } from 'react-bootstrap'
import { ethers } from 'ethers'

// Components
import Navigation from './Navigation';
import Create from './Create';
import Proposals from './Proposals';
import ProposalAnalytics from './ProposalAnalytics';
import Loading from './Loading';

// ABIs: Import your contract ABIs here
import DAO_ABI from '../abis/DAO.json'

// Config: Import your network config here
import config from '../config.json';

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

  const loadBlockchainData = async () => {
    if (!window.ethereum) {
      console.error('MetaMask not detected')
      setIsLoading(false)
      return
    }

    try {
      console.log('Loading blockchain data...')
      
      // Initiate provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)
      console.log('Provider set')

      // Check network
      const network = await provider.getNetwork()
      console.log('Network:', network)
      
      if (!config[network.chainId]) {
        throw new Error(`Unsupported network. Please switch to localhost (chainId: 31337)`)
      }

      // Initiate contracts
      const dao = new ethers.Contract(config[network.chainId].dao.address, DAO_ABI, provider)
      setDao(dao)
      console.log('DAO contract set')

      // Fetch treasury balance
      let treasuryBalance = await provider.getBalance(dao.address)
      treasuryBalance = ethers.utils.formatUnits(treasuryBalance, 18)
      setTreasuryBalance(treasuryBalance)
      console.log('Treasury balance:', treasuryBalance)

      // Fetch accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }
      const account = ethers.utils.getAddress(accounts[0])
      setAccount(account)
      console.log('Account set:', account)

      // Fetch proposals count
      const count = await dao.proposalCount()
      console.log('Proposal count:', count.toString())
      const items = []

      // "i" = iterator
      for(var i = 0; i < count; i++) {
        const proposal = await dao.proposals(i + 1) // i+1 b/c i=0 initially
        items.push(proposal) // "push" is a function that adds (at the end) to the items array above
      }

      setProposals(items)
      console.log('Proposals loaded:', items)

      // Fetch quorum
      const quorumValue = await dao.quorum()
      setQuorum(quorumValue)
      console.log('Quorum:', quorumValue.toString())

      setIsLoading(false)
      setWalletConnected(true)
      console.log('Blockchain data loaded successfully')
    } catch (error) {
      console.error('Error loading blockchain data:', error)
      setError(error.message)
      setIsLoading(false)
      setWalletConnected(false)
    }
  }

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
  }, []);

  return(
    <Container style={{ paddingTop: '80px' }}>
      <Navigation account={account} walletConnected={walletConnected} />

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
            />
          )}
        </>
      )}
    </Container>
  )
}

export default App;
