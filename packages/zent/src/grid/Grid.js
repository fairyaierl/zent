import React, { PureComponent, Component } from 'react';
import PropTypes from 'prop-types';
import Loading from 'loading';
import classnames from 'classnames';
import has from 'lodash/has';
import get from 'lodash/get';
import every from 'lodash/every';
import assign from 'lodash/assign';
import indexOf from 'lodash/indexOf';
import forEach from 'lodash/forEach';
import noop from 'lodash/noop';
import size from 'lodash/size';
import some from 'lodash/some';
import isFunction from 'lodash/isFunction';
import filter from 'lodash/filter';
import cloneDeep from 'lodash/cloneDeep';
import includes from 'lodash/includes';
import Store from './Store';
import ColGroup from './ColGroup';
import Header from './Header';
import Body from './Body';
import Footer from './Footer';
import SelectionCheckbox from './SelectionCheckbox';
import SelectionCheckboxAll from './SelectionCheckboxAll';

function stopPropagation(e) {
  e.stopPropagation();
  if (e.nativeEvent.stopImmediatePropagation) {
    e.nativeEvent.stopImmediatePropagation();
  }
}

class Grid extends (PureComponent || Component) {
  constructor(props) {
    super(props);
    this.checkboxPropsCache = {};
    this.store = new Store(props);
    this.store.setState({
      columns: this.getColumns(props, props.columns),
      selectedRowKeys: get(props, 'selection.selectedRowKeys')
    });
    this.setScrollPosition('left');
  }

  onChange = conf => {
    const params = assign({}, this.store.getState('conf'), conf);
    this.store.setState('conf', params);
    this.props.onChange(params);
  };

  getDataKey = (data, rowIndex) => {
    const { rowKey } = this.props;
    return rowKey ? get(data, rowKey) : rowIndex;
  };

  isAnyColumnsFixed = () => {
    return this.store.getState('isAnyColumnsFixed', () =>
      some(this.store.getState('columns'), column => !!column.fixed)
    );
  };

  isAnyColumnsLeftFixed = () => {
    return this.store.getState('isAnyColumnsLeftFixed', () =>
      some(
        this.store.getState('columns'),
        column => column.fixed === 'left' || column.fixed === true
      )
    );
  };

  isAnyColumnsRightFixed = () => {
    return this.store.getState('isAnyColumnsRightFixed', () =>
      some(this.store.getState('columns'), column => column.fixed === 'right')
    );
  };

  getLeftColumns = () => {
    return filter(
      this.store.getState('columns'),
      column => column.fixed === 'left' || column.fixed === true
    );
  };

  getRightColumns = () => {
    return filter(
      this.store.getState('columns'),
      column => column.fixed === 'right'
    );
  };

  getColumns = (props, columns) => {
    let { selection, datasets } = props || this.props;
    columns = cloneDeep(columns || this.store.getState('columns'));

    if (selection) {
      const data = filter(datasets, (item, index) => {
        const rowIndex = this.getDataKey(item, index);

        if (selection.getCheckboxProps) {
          return !get(this.getCheckboxPropsByItem(item, rowIndex), 'disabled');
        }
        return true;
      });

      const selectionColumn = {
        key: 'selection-column',
        width: '20px',
        bodyRender: this.renderSelectionCheckbox(selection.type)
      };

      const checkboxAllDisabled = every(data, (item, index) => {
        const rowIndex = this.getDataKey(item, index);
        return get(this.getCheckboxPropsByItem(item, rowIndex), 'disabled');
      });

      selectionColumn.title = (
        <SelectionCheckboxAll
          store={this.store}
          datasets={data}
          getDataKey={this.getDataKey}
          onSelect={this.handleBatchSelect}
          disabled={checkboxAllDisabled}
        />
      );

      if (
        columns.some(column => column.fixed === 'left' || column.fixed === true)
      ) {
        selectionColumn.fixed = 'left';
      }

      if (columns[0] && columns[0].key === 'selection-column') {
        columns[0] = selectionColumn;
      } else {
        columns.unshift(selectionColumn);
      }
    }

    return columns;
  };

  getLeftFixedTable = () => {
    return this.getTable({
      columns: this.getLeftColumns(),
      fixed: 'left'
    });
  };

  getRightFixedTable = () => {
    return this.getTable({
      columns: this.getRightColumns(),
      fixed: 'left'
    });
  };

  setScrollPosition(position) {
    this.scrollPosition = position;

    if (this.tableNode) {
      const { prefix } = this.props;
      if (position === 'both') {
        this.tableNode.className = this.tableNode.className.replace(
          new RegExp(`${prefix}-grid-scroll-position-.+$`, 'gi'),
          ' '
        );
        this.tableNode.classList.add(`${prefix}-grid-scroll-position-left`);
        this.tableNode.classList.add(`${prefix}-grid-scroll-position-right`);
      } else {
        this.tableNode.className = this.tableNode.className.replace(
          new RegExp(`${prefix}-grid-scroll-position-.+$`, 'gi'),
          ' '
        );
        this.tableNode.classList.add(
          `${prefix}-grid-scroll-position-${position}`
        );
      }
    }
  }

  handleBodyScroll = e => {
    if (e.currentTarget !== e.target) {
      return;
    }
    const target = e.target;
    const { scroll = {} } = this.props;

    if (target.scrollLeft !== this.lastScrollLeft && scroll.x) {
      const node = target || this.bodyTable;
      const scrollToLeft = node.scrollLeft === 0;
      const scrollToRight =
        node.scrollLeft + 1 >=
        node.children[0].getBoundingClientRect().width -
          node.getBoundingClientRect().width;
      if (scrollToLeft && scrollToRight) {
        this.setScrollPosition('both');
      } else if (scrollToLeft) {
        this.setScrollPosition('left');
      } else if (scrollToRight) {
        this.setScrollPosition('right');
      } else if (this.scrollPosition !== 'middle') {
        this.setScrollPosition('middle');
      }
    }
    this.lastScrollLeft = target.scrollLeft;
  };

  getTable = (options = {}) => {
    const {
      prefix,
      datasets,
      scroll,
      sortType,
      sortBy,
      rowClassName,
      onRowClick,
      ellipsis
    } = this.props;
    const { fixed } = options;
    const columns = options.columns || this.store.getState('columns');
    let tableClassName = '';
    let bodyStyle = {};
    let tableStyle = {};

    if (fixed || scroll.x) {
      tableClassName = `${prefix}-grid-fixed`;
      bodyStyle.overflowX = 'auto';
    }

    if (!fixed && scroll.x) {
      tableStyle.width = scroll.x;
    }

    return (
      <div
        style={bodyStyle}
        ref={ref => (this.bodyTable = ref)}
        onScroll={this.handleBodyScroll}
        key="table"
      >
        <table
          className={classnames(`${prefix}-grid-table`, tableClassName, {
            [`${prefix}-grid-table-ellipsis`]: ellipsis
          })}
          style={tableStyle}
        >
          <ColGroup columns={columns} />
          <Header
            prefix={prefix}
            columns={columns}
            store={this.store}
            onChange={this.onChange}
            sortType={sortType}
            sortBy={sortBy}
          />
          <Body
            prefix={prefix}
            columns={columns}
            datasets={datasets}
            rowClassName={rowClassName}
            onRowClick={onRowClick}
          />
        </table>
      </div>
    );
  };

  getEmpty = () => {
    const { datasets, prefix, emptyLabel } = this.props;

    if (size(datasets) === 0) {
      return (
        <div className={`${prefix}-grid-empty`} key="empty">
          {emptyLabel}
        </div>
      );
    }
    return null;
  };

  getCheckboxPropsByItem = (data, rowIndex) => {
    const { selection } = this.props;

    if (!get(selection, 'getCheckboxProps')) {
      return {};
    }

    if (!this.checkboxPropsCache[rowIndex]) {
      this.checkboxPropsCache[rowIndex] = selection.getCheckboxProps(data);
    }
    return this.checkboxPropsCache[rowIndex];
  };

  onSelectChange = (selectedRowKeys, data) => {
    const { datasets, selection } = this.props;
    const onSelect = get(selection, 'onSelect');

    if (isFunction(onSelect)) {
      const selectedRows = filter(datasets, (row, i) =>
        includes(selectedRowKeys, this.getDataKey(row, i))
      );
      onSelect(selectedRowKeys, selectedRows, data);
    }
  };

  handleSelect = (data, rowIndex, e) => {
    const checked = e.target.checked;

    let selectedRowKeys = this.store.getState('selectedRowKeys');

    if (checked) {
      selectedRowKeys.push(rowIndex);
    } else {
      selectedRowKeys = filter(selectedRowKeys, i => rowIndex !== i);
    }

    this.store.setState({ selectedRowKeys });

    this.onSelectChange(selectedRowKeys, data);
  };

  handleBatchSelect = (type, data) => {
    let selectedRowKeys = cloneDeep(this.store.getState('selectedRowKeys'));

    let changeRowKeys = [];

    switch (type) {
      case 'selectAll':
        forEach(data, (key, index) => {
          const rowIndex = this.getDataKey(key, index);
          if (!includes(selectedRowKeys, rowIndex)) {
            selectedRowKeys.push(rowIndex);
            changeRowKeys.push(rowIndex);
          }
        });
        break;
      case 'removeAll':
        forEach(data, (key, index) => {
          const rowIndex = this.getDataKey(key, index);
          if (includes(selectedRowKeys, rowIndex)) {
            selectedRowKeys.splice(indexOf(selectedRowKeys, rowIndex), 1);
            changeRowKeys.push(key);
          }
        });
        break;
      default:
        break;
    }

    this.store.setState({ selectedRowKeys });

    const changeRow = filter(data, (row, i) =>
      includes(changeRowKeys, this.getDataKey(row, i))
    );

    this.onSelectChange(selectedRowKeys, changeRow);
  };

  renderSelectionCheckbox = () => {
    return (data, { row }) => {
      const rowIndex = this.getDataKey(data, row);
      const props = this.getCheckboxPropsByItem(data, rowIndex);

      return (
        <span onClick={stopPropagation}>
          <SelectionCheckbox
            disabled={props.disabled}
            rowIndex={rowIndex}
            store={this.store}
            onChange={e =>
              this.handleSelect(data, this.getDataKey(data, row), e)}
          />
        </span>
      );
    };
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.selection && has(nextProps.selection, 'selectedRowKeys')) {
      this.store.setState({
        selectedRowKeys: nextProps.selection.selectedRowKeys || [],
        columns: this.getColumns(nextProps)
      });

      const { selection } = this.props;
      if (
        selection &&
        nextProps.selection.getCheckboxProps !== selection.getCheckboxProps
      ) {
        this.CheckboxPropsCache = {};
      }
    }

    if (nextProps.columns && nextProps.columns !== this.props.columns) {
      this.store.setState({
        columns: this.getColumns(nextProps)
      });
    }

    if (
      has(nextProps, 'datasets') &&
      nextProps.datasets !== this.props.datasets
    ) {
      this.CheckboxPropsCache = {};
    }
  }

  render() {
    const { prefix, loading, pageInfo } = this.props;
    let className = `${prefix}-grid`;
    className = classnames(className, this.props.className);

    if (this.scrollPosition === 'both') {
      className = classnames(
        className,
        `${prefix}-grid-scroll-position-left`,
        `${prefix}-grid-scroll-position-right`
      );
    } else {
      className = classnames(
        className,
        `${prefix}-grid-scroll-position-left`,
        `${prefix}-grid-scroll-position-${this.scrollPosition}`
      );
    }

    const content = [
      this.getTable(),
      this.getEmpty(),
      <Footer
        key="footer"
        prefix={prefix}
        pageInfo={pageInfo}
        onChange={this.onChange}
      />
    ];

    const scrollTable = this.isAnyColumnsFixed() ? (
      <div className={`${prefix}-grid-scroll`}>{content}</div>
    ) : (
      content
    );

    return (
      <div className={className} ref={node => (this.tableNode = node)}>
        <Loading show={loading}>
          {scrollTable}
          {this.isAnyColumnsLeftFixed() && (
            <div className={`${prefix}-grid-fixed-left`}>
              {this.getLeftFixedTable()}
            </div>
          )}
          {this.isAnyColumnsRightFixed() && (
            <div className={`${prefix}-grid-fixed-right`}>
              {this.getRightFixedTable()}
            </div>
          )}
        </Loading>
      </div>
    );
  }
}

Grid.propTypes = {
  className: PropTypes.string,
  rowClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  prefix: PropTypes.string,
  datasets: PropTypes.array,
  columns: PropTypes.array,
  loading: PropTypes.bool,
  pageInfo: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
  onChange: PropTypes.func,
  selection: PropTypes.object,
  rowKey: PropTypes.string,
  scroll: PropTypes.object,
  sortBy: PropTypes.string,
  sortType: PropTypes.string,
  onRowClick: PropTypes.func,
  ellipsis: PropTypes.bool
};

Grid.defaultProps = {
  className: '',
  prefix: 'zent',
  datasets: [],
  columns: [],
  loading: false,
  pageInfo: false,
  onChange: noop,
  selection: null,
  rowKey: 'id',
  emptyLabel: '没有更多数据了',
  scroll: {},
  onRowClick: noop,
  ellipsis: false
};

export default Grid;
