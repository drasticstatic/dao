import { useEffect, useState } from 'react'
import { Container } from 'react-bootstrap'
import { ethers } from 'ethers'

// Components
import Navigation from './Navigation';
import Create from './Create';
import Proposals from './Proposals';
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

  const loadBlockchainData = async () => {
    // Initiate provider
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    // Initiate contracts
    const dao = new ethers.Contract(config[31337].dao.address, DAO_ABI, provider)
    setDao(dao)

    // Fetch treasury balance
    let treasuryBalance = await provider.getBalance(dao.address)
    treasuryBalance = ethers.utils.formatUnits(treasuryBalance, 18)
    setTreasuryBalance(treasuryBalance)

    // Fetch accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const account = ethers.utils.getAddress(accounts[0])
    setAccount(account)

    // Fetch proposals count
    const count = await dao.proposalCount()
    const items = []

    // "i" = iterator
    for(var i = 0; i < count; i++) {
      const proposal = await dao.proposals(i + 1) // i+1 b/c i=0 initially
      items.push(proposal) // "push" is a function that adds (at the end) to the items array above
    }

    setProposals(items)

    console.log(items)

    // Fetch quorum
    setQuorum(await dao.quorum())

    setIsLoading(false)
  }

  useEffect(() => {
    if (isLoading) {
      loadBlockchainData()
    }
  }, [isLoading]);

  return(
    <Container>
      <Navigation account={account} />

      <div className="text-center my-4">
        <h1 className='mb-2'>Welcome to our DAO!</h1>
        <p className="text-muted">
          A Decentralized Autonomous Organization where token holders vote on funding proposals
        </p>
      </div>

      {isLoading ? (
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

          <Proposals
            provider={provider}
            dao={dao}
            proposals={proposals}
            quorum={quorum}
            setIsLoading={setIsLoading}
          />
        </>
      )}
    </Container>
  )
}

export default App;
