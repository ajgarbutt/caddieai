import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-light-grey">
            <AlertTriangle className="h-7 w-7 text-danger" strokeWidth={2} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-dark-green">
            Something went wrong
          </h2>
          <p className="mb-6 max-w-xs text-sm text-gray-600">
            An unexpected error occurred. Reloading will fetch your saved
            account again.
          </p>
          <Button onClick={this.handleReset}>Try again</Button>
        </div>
      )
    }

    return this.props.children
  }
}
