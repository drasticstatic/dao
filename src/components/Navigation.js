import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';

import logo from '../logo.png';

const Navigation = ({ account, walletConnected }) => {
  const isConnected = walletConnected && account && account.length > 0;
  
  return (
    <Navbar fixed="top" bg="white" className="py-2 shadow-sm">
      <Container>
        <img
          alt="logo"
          src={logo}
          width="40"
          height="40"
          className="d-inline-block align-top me-3"
        />
      <Navbar.Brand href="#">Dapp University DAO</Navbar.Brand>
      <Navbar.Collapse className="justify-content-end">
        <Navbar.Text className="d-flex align-items-center">
          {isConnected ? (
            <>
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
            </>
          ) : (
            <span className="d-flex align-items-center">
              <span className="me-1">Not Connected</span>
              <span 
                className="badge bg-warning text-dark" 
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                title="Not Connected"
              >
                ⚠
              </span>
            </span>
          )}
        </Navbar.Text>
      </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
