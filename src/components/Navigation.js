import { useState, useEffect } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import { Dropdown, Badge } from 'react-bootstrap';

import logo from '../logo.png';

const Navigation = ({ account, walletConnected, notifications = [], onMarkNotificationRead, onShowAllNotifications }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Count unread notifications
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_proposal': return '📝';
      case 'deadline_approaching': return '⏰';
      case 'proposal_finalized': return '✅';
      case 'proposal_cancelled': return '❌';
      default: return '📢';
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };
  const isConnected = walletConnected && account && account.length > 0;

  return (
    <Navbar fixed="top" bg="white" className="py-2 shadow-sm" expand="lg">
      <Container className="px-3" style={{ maxWidth: '1200px' }}>
        <div className="d-flex align-items-center">
          <img
            alt="logo"
            src={logo}
            width="40"
            height="40"
            className="d-inline-block align-top me-2"
          />
          <Navbar.Brand href="#" className="mb-0">
            <span className="d-none d-md-inline">Dapp University DAO</span>
            <span className="d-md-none">DAO</span>
          </Navbar.Brand>
        </div>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
        <div className="d-flex align-items-center justify-content-center flex-wrap">
          {/* Mobile App Link */}
          <span className="me-2 me-md-3 d-flex align-items-center">
            <span
              className="text-muted"
              style={{ fontSize: '0.8rem', cursor: 'pointer' }}
              title="Mobile app coming soon!"
            >
              <span className="d-none d-sm-inline">📱 Mobile App</span>
              <span className="d-sm-none">📱</span>
              <Badge bg="info" className="ms-1" style={{ fontSize: '0.6rem' }}>
                <span className="d-none d-sm-inline">Coming Soon</span>
                <span className="d-sm-none">Soon</span>
              </Badge>
            </span>
          </span>

          {/* Notifications Dropdown */}
          <Dropdown align="end" className="me-2 me-md-3">
          <Dropdown.Toggle
            variant="outline-secondary"
            id="notifications-dropdown"
            className="position-relative border-0"
            style={{ background: 'transparent' }}
          >
            🔔
            {unreadCount > 0 && (
              <Badge
                bg="danger"
                pill
                className="position-absolute top-0 start-100 translate-middle"
                style={{ fontSize: '0.6rem' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Dropdown.Toggle>

          <Dropdown.Menu
            className="notifications-dropdown"
            style={{
              minWidth: '280px',
              maxWidth: '350px',
              width: '90vw',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
            <Dropdown.Header>
              <div className="d-flex justify-content-between align-items-center">
                <span>Notifications</span>
                <Badge bg="secondary">{notifications.length}</Badge>
              </div>
            </Dropdown.Header>

            {notifications.length === 0 ? (
              <Dropdown.Item disabled className="text-center py-3">
                <div className="text-muted">
                  <div>📭</div>
                  <small>No notifications yet</small>
                </div>
              </Dropdown.Item>
            ) : (
              notifications.slice(0, 10).reverse().map((notification, index) => (
                <Dropdown.Item
                  key={index}
                  className={`py-2 ${!notification.read ? 'bg-light' : ''}`}
                  style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}
                  onClick={() => {
                    if (!notification.read && onMarkNotificationRead) {
                      onMarkNotificationRead(index);
                    }
                  }}
                >
                  <div className="d-flex align-items-start">
                    <span className="me-2" style={{ fontSize: '1.2rem' }}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-grow-1">
                      <div className="fw-bold" style={{ fontSize: '0.9rem' }}>
                        {notification.title}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {notification.message}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {getTimeAgo(notification.timestamp)}
                      </div>
                    </div>
                    {!notification.read && (
                      <Badge bg="primary" pill style={{ fontSize: '0.5rem' }}>
                        New
                      </Badge>
                    )}
                  </div>
                </Dropdown.Item>
              ))
            )}

            {/* Always show "See More" at the bottom - sticky position */}
            <Dropdown.Divider />
            <Dropdown.Item
              className="text-center"
              onClick={() => onShowAllNotifications && onShowAllNotifications()}
              style={{
                position: 'sticky',
                bottom: -8,
                backgroundColor: '#f8f9fa',
                borderTop: '1.3px solid #dee2e6',
                zIndex: 1000,
                marginTop: 'auto'
              }}
            >
              <small className="text-primary" style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                {notifications.length > 10
                  ? `See More (${notifications.length - 10} more)`
                  : notifications.length > 0
                    ? 'See More'
                    : 'View All Notifications'
                }
              </small>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

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
        </div>
      </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
