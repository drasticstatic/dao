import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { ethers } from 'ethers'

const Create = ({ provider, dao, setIsLoading }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [address, setAddress] = useState('')
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
      const formattedAmount = ethers.utils.parseUnits(amount.toString(), 'ether')

      const transaction = await dao.connect(signer).createProposal(name, description, formattedAmount, address)
      await transaction.wait()
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
    }

    setIsLoading(true)
  }

  return(
    <Form onSubmit={createHandler}>
      <Form.Group style={{ maxWidth: '450px', margin: '50px auto' }}>
        <div className="text-center mb-3">
          <small className="text-muted"><em>* All fields are required</em></small>
        </div>
        <Form.Control
          type='text'
          placeholder='Enter proposal name'
          className='my-2'
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
            placeholder='Enter description'
            className='my-2'
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </OverlayTrigger>
        <Form.Control
          type='number'
          placeholder='Enter amount'
          className='my-2'
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Form.Control
          type='text'
          placeholder="Enter recipient's address"
          className='my-2'
          onChange={(e) => setAddress(e.target.value)}
          required
        />
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
