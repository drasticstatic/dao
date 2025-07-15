import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { ethers } from 'ethers'

const Create = ({ provider, dao, setIsLoading, loadBlockchainData, onProposalCreated }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [deadline, setDeadline] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)

  const createHandler = async (e) => {
    e.preventDefault()//keeps page from refreshing
    console.log('Creating proposal...\n' +
                 'Name: ' + name + '\n' +
                 'Description: ' + description + '\n' +
                 'Amount: ' + amount + '\n' +
                 'Recipient: ' + address)
    setIsWaiting(true)

    try {
      const signer = await provider.getSigner()
      // Convert amount from ETH to Wei (smallest unit of Ether)
      // parseUnits converts human-readable ETH amount to blockchain-compatible Wei
      const formattedAmount = ethers.utils.parseUnits(amount || '0', 'ether')

      // Determine which function to call based on whether deadline is set
      let transaction;

      if (deadline) {
        // Convert deadline to Unix timestamp (seconds since Jan 1, 1970)
        const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);

        // Call the createProposalWithDeadline function for proposals with deadlines
        transaction = await dao.connect(signer).createProposalWithDeadline(
          name,
          description,
          formattedAmount,
          address,
          deadlineTimestamp
        );
      } else {
        // Call the standard createProposal function for proposals without deadlines
        transaction = await dao.connect(signer).createProposal(
          name,
          description,
          formattedAmount,
          address
        );
      }
      await transaction.wait()

      // Success - show success message and reload blockchain data
      const successMsg = `✓ Proposal created successfully! 🎉 \n\n\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Your proposal is now live for community voting. 🗳️`;
      if (onProposalCreated) {
        onProposalCreated(successMsg);
      }

      console.log('Proposal creation successful, reloading data...');
      await loadBlockchainData();

      // Clear form after successful creation
      setName('')
      setDescription('')
      setAmount('')
      setAddress('')
      setDeadline('')

    } catch (error) {
      console.error('Error creating proposal:', error);

      // Check if the error is due to not being a token holder
      if (error.reason && error.reason.includes('must be token holder')) {
        window.alert('You must be a token holder to create proposals. Please acquire DAO tokens first.');
      } else if (error.message && error.message.includes('must be token holder')) {
        window.alert('You must be a token holder to create proposals. Please acquire DAO tokens first.');
      } else if (error.message && error.message.includes('user rejected')) {
        window.alert('Transaction was rejected by the user.');
      } else {
        window.alert('Transaction failed. Please check console for details.');
      }
    } finally {
      // Always reset loading state
      setIsWaiting(false);
    }
  }

  return(
    <Form onSubmit={createHandler}>
      <Form.Group style={{ maxWidth: '450px', margin: '50px auto' }}>
        <Form.Control
          type='text'
          placeholder='* Enter proposal name'
          className='my-2'
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>This description will later display in tooltip when hovering over proposal name in proposals list</Tooltip>}
        >
          <Form.Control
            as='textarea'
            rows={3}
            placeholder='* Enter description'
            className='my-2'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </OverlayTrigger>
        <Form.Control
          type='number'
          placeholder='* Enter amount'
          className='my-2'
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Form.Control
          type='text'
          placeholder="* Enter recipient's address '0x...'"
          className='my-2'
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <div className="text-center mb-3">
          <small className="text-muted"><em>* = required fields</em></small>
        </div>

        <Form.Label><small>Voting Deadline: <em>(Optional)</em></small></Form.Label>
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip>
              Leave empty for no deadline. Voting will remain open indefinitely.
            </Tooltip>
          }
        >
          <Form.Control
            type='datetime-local'
            placeholder='Select voting deadline'
            className='my-2'
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 16)} // Prevent past dates
          />
        </OverlayTrigger>
        {isWaiting ? (
          <Spinner animation="border" style={{ display: 'block', margin: '0 auto' }} />
        ) : (
          <Button
            variant='primary'
            type='submit'
            style={{
              width: '33%',
              display: 'block',
              margin: '0 auto',
              marginTop: '15px'
            }}
          >
            Create Proposal
          </Button>
        )}
      </Form.Group>
    </Form>
  )
}

export default Create;
