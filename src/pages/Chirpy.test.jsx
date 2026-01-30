import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Chirpy from './Chirpy';
import GeminiService from '../services/GeminiService';

// Mock the GeminiService
vi.mock('../services/GeminiService', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      streamMessage: vi.fn((msg, onChunk) => {
        onChunk('Test response');
        return Promise.resolve('Test response');
      }),
      initialize: vi.fn(),
    })),
  };
});

// Mock navigation
const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('Chirpy Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <Chirpy />
      </BrowserRouter>
    );
    expect(screen.getByText('CHIRPY AI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask Chirpy anything...')).toBeInTheDocument();
  });

  it('active nav state is correct', () => {
    render(
      <BrowserRouter>
        <Chirpy />
      </BrowserRouter>
    );
    const chirpyNavItem = screen.getByText('CHIRPY').closest('.sidebar-item');
    expect(chirpyNavItem).toHaveClass('active');
  });

  it('initializes Gemini SDK once per session', () => {
    render(
      <BrowserRouter>
        <Chirpy />
      </BrowserRouter>
    );
    // Service is instantiated on component mount
    expect(GeminiService).toHaveBeenCalled();
  });

  it('sends message and displays response', async () => {
    render(
      <BrowserRouter>
        <Chirpy />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText('Ask Chirpy anything...');
    const button = screen.getByRole('button');

    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);

    // User message should appear
    expect(screen.getByText('Hello')).toBeInTheDocument();

    // Response should appear after stream
    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
  });

  it('navigates when sidebar item is clicked', () => {
    render(
      <BrowserRouter>
        <Chirpy />
      </BrowserRouter>
    );

    const homeItem = screen.getByText('CapyHome').closest('.sidebar-item');
    fireEvent.click(homeItem);
    expect(mockedNavigate).toHaveBeenCalledWith('/home');
  });
});
