import Navbar from 'react-bootstrap/Navbar';

import logo from '../logo.png';

const Navigation = ({ account }) => {
  return (
    <Navbar className='my-3'>
      <img
        alt="logo"
        src={logo}
        width="40"
        height="40"
        className="d-inline-block align-top mx-3"
      />
      <Navbar.Brand href="#">Dapp University DAO</Navbar.Brand>
      <Navbar.Collapse className="justify-content-end">
        <Navbar.Text className="d-flex align-items-center">
          <span className="me-2 d-flex align-items-center">
            <span className="me-1">Connected</span>
            <span 
              className="badge bg-success text-white" 
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
              title="Connected"
            >
              ✓
            </span>
          </span>
          <span className="me-1">&nbsp;Your Address:</span>
          <span 
            className="badge bg-light text-dark border" 
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(account).then(() => {
                alert('Address copied to clipboard!');
              });
            }}
            title="Click to copy address"
          >
            {account.slice(0, 5) + '...' + account.slice(38, 42)}
          </span>
        </Navbar.Text>
      </Navbar.Collapse>
    </Navbar>
  );
}

export default Navigation;
