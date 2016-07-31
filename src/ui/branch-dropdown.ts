import { React } from '../brackets';
import Strings from 'strings';

export default class BranchDropdown extends React.Component {

  constructor(props) {
    super(props);
  }

  state = {
    count: 1
  }

  handleClick = () => {
    this.setState({
      count: this.state.count + 1
    });
  }

  renderBranch = branch => {
    return <li className="branch">
      <span className="trash-icon" title={ Strings.DELETE_BRANCH }>
        &times;
      </span>
      <span className="merge-icon" title={ Strings.MERGE_BRANCH }>
        <i className="octicon octicon-git-merge"></i>
      </span>
      <span className="branch-name">{ branch.name }</span>
    </li>;
  }

  render = () => {
    return <ul className="branch-list">
      <li className="branch-new">{ Strings.CREATE_NEW_BRANCH }</li>
      { this.props.branches.length > 0 ? <li className="divider"></li> : null }
      { this.props.branches.map(b => this.renderBranch(b)) }
    </ul>;
  }

}
